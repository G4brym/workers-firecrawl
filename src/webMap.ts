import puppeteer, { type Browser } from "@cloudflare/puppeteer";
import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import type { AppContext, Env } from "./index";

async function getBrowser(env: Env): Promise<Browser> {
	return await puppeteer.launch(env.BROWSER);
}

async function discoverLinks(
	browser: Browser,
	url: string,
	includeSubdomains: boolean,
): Promise<string[]> {
	const page = await browser.newPage();
	try {
		await page.goto(url, { waitUntil: "domcontentloaded" });

		const targetHostname = new URL(url).hostname;

		const links: string[] = await page.evaluate(
			(targetHost: string, includeSubs: boolean) => {
				const anchors = Array.from(document.querySelectorAll("a"));
				const hrefs: string[] = [];
				for (const a of anchors) {
					const href = a.href;
					if (!href || !href.startsWith("http")) continue;
					try {
						const linkHost = new URL(href).hostname;
						const matches = includeSubs
							? linkHost === targetHost || linkHost.endsWith(`.${targetHost}`)
							: linkHost === targetHost;
						if (matches) {
							hrefs.push(href);
						}
					} catch {
						// Skip invalid URLs
					}
				}
				return hrefs;
			},
			targetHostname,
			includeSubdomains,
		);

		// Normalize and deduplicate
		const seen = new Set<string>();
		const result: string[] = [];
		for (const link of links) {
			try {
				const parsed = new URL(link);
				parsed.hash = "";
				// Remove trailing slash for consistency (except root path)
				let normalized = parsed.toString();
				if (normalized.endsWith("/") && parsed.pathname !== "/") {
					normalized = normalized.slice(0, -1);
				}
				if (!seen.has(normalized)) {
					seen.add(normalized);
					result.push(normalized);
				}
			} catch {
				// Skip invalid URLs
			}
		}

		return result;
	} catch (error) {
		console.error(
			`Link discovery failed for ${url}: ${(error as Error).message}`,
		);
		return [];
	} finally {
		await page.close();
	}
}

async function parseSitemap(baseUrl: string): Promise<string[]> {
	try {
		const origin = new URL(baseUrl).origin;
		const sitemapUrl = `${origin}/sitemap.xml`;
		const response = await fetch(sitemapUrl);

		if (!response.ok) {
			return [];
		}

		const text = await response.text();
		const urls: string[] = [];
		const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
		let match: RegExpExecArray | null;
		while ((match = locRegex.exec(text)) !== null) {
			const loc = match[1].trim();
			if (loc.startsWith("http")) {
				urls.push(loc);
			}
		}

		return urls;
	} catch {
		return [];
	}
}

export class WebMap extends OpenAPIRoute {
	schema = {
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							url: z.string().url(),
							search: z.string().optional(),
							ignoreSitemap: z.boolean().default(false).optional(),
							includeSubdomains: z.boolean().default(false).optional(),
							limit: z.number().min(1).max(5000).default(5000).optional(),
						}),
					},
				},
			},
		},
		responses: {
			200: {
				description: "response",
				...contentJson({
					success: z.boolean(),
					links: z.string().array(),
				}),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const browser = await getBrowser(c.env);
		try {
			const pageLinks = await discoverLinks(
				browser,
				data.body.url,
				data.body.includeSubdomains ?? false,
			);

			let sitemapLinks: string[] = [];
			if (!data.body.ignoreSitemap) {
				sitemapLinks = await parseSitemap(data.body.url);
			}

			// Merge and deduplicate
			const allLinks = new Set<string>([...pageLinks, ...sitemapLinks]);
			let links = Array.from(allLinks);

			// Filter by search term if provided
			if (data.body.search) {
				const searchLower = data.body.search.toLowerCase();
				links = links.filter((link) =>
					link.toLowerCase().includes(searchLower),
				);
			}

			// Sort alphabetically for deterministic output
			links.sort();

			// Apply limit
			links = links.slice(0, data.body.limit);

			return {
				success: true,
				links: links,
			};
		} finally {
			await browser.close();
		}
	}
}
