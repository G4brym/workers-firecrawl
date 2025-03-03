import puppeteer, { type Browser } from "@cloudflare/puppeteer";
import { OpenAPIRoute, contentJson } from "chanfana";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { z } from "zod";
import type { AppContext, Env } from "./index";

async function getBrowser(env: Env): Promise<Browser> {
	return await puppeteer.launch(env.BROWSER);
}

async function performSearch(browser: Browser, query: string, limit: number) {
	const page = await browser.newPage();
	try {
		const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
		await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
		await page.waitForSelector('[data-testid="result-title-a"]', {
			timeout: 10000,
		}); // Wait for result title links
		const urls = await page.evaluate(() => {
			const links = Array.from(
				document.querySelectorAll(
					'li[data-layout="organic"] [data-testid="result-title-a"]',
				),
			);
			return links
				.map((link) => link.href)
				.filter((url) => url && url.startsWith("http")); // Ensure valid URLs
		});
		return urls.slice(0, limit); // Take top x organic results;
	} catch (error) {
		throw new Error(`Search failed: ${(error as Error).message}`);
	} finally {
		await page.close();
	}
}

async function extractContent(browser: Browser, url: string) {
	const page = await browser.newPage();
	try {
		const response = await page.goto(url, { waitUntil: "domcontentloaded" });
		const statusCode = response ? response.status() : 0;

		// Attempt to close popups
		await page.evaluate(() => {
			const closeButtons = Array.from(
				document.querySelectorAll("button, a"),
			).filter(
				(el) =>
					el.textContent.toLowerCase().includes("close") ||
					el.textContent.includes("×"),
			);
			closeButtons.forEach((btn) => btn.click());
		});
		await page.waitForTimeout(1000); // Allow popups to close

		// Extract title, description, and main content
		const { title, description, content } = await page.evaluate(() => {
			// Get page title
			const pageTitle = document.title || "No title available";

			// Get meta description
			const metaDescription = document.querySelector(
				'meta[name="description"]',
			);
			const descriptionText = metaDescription
				? metaDescription.getAttribute("content")
				: "No description available";

			// Extract main content (simplified readability approach)
			const body = document.body.cloneNode(true);
			body
				.querySelectorAll("script, style, nav, header, footer")
				.forEach((el) => el.remove());
			const mainContent = body.outerHTML;

			return {
				title: pageTitle,
				description: descriptionText,
				content: mainContent || "No content extracted",
			};
		});
		const links = await page.evaluate(() => {
			const anchors = Array.from(document.querySelectorAll("a"));
			return anchors.map((a) => a.href).filter((a) => a !== "");
		});

		const rawHtml = await page.content();

		return {
			title: title,
			description: description,
			url: url,
			markdown: NodeHtmlMarkdown.translate(
				/* html */ content,
				/* options (optional) */ {},
				/* customTranslators (optional) */ undefined,
				/* customCodeBlockTranslators (optional) */ undefined,
			),
			html: rawHtml,
			rawHtml: rawHtml,
			links: links,
			screenshot: null,
			metadata: {
				title: title,
				description: description,
				sourceUrl: url,
				statusCode: statusCode,
				error: null,
			},
		};
	} catch (error) {
		throw new Error(
			`Content extraction failed for ${url}: ${(error as Error).message}`,
		);
	} finally {
		await page.close();
	}
}

export class WebSearch extends OpenAPIRoute {
	schema = {
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							query: z.string(),
							limit: z.number().min(1).max(10).default(5).optional(),
							tbs: z.string().optional(),
							lang: z.string().default("en").optional(),
							country: z.string().default("us").optional(),
							location: z.string().optional(),
							timeout: z.number().default(60000).optional(),
							scrapeOptions: z
								.object({
									formats: z
										.enum([
											"markdown",
											"html",
											"rawHtml",
											"links",
											"screenshot",
											"screenshot@fullPage",
											"extract",
										])
										.array()
										.optional(),
								})
								.optional(),
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
					data: z
						.object({
							title: z.string(),
							description: z.string(),
							url: z.string(),
							markdown: z.string(),
							html: z.string(),
							rawHtml: z.string(),
							links: z.string().array(),
							screenshot: z.string(),
							metadata: z.object({
								title: z.string(),
								description: z.string(),
								sourceURL: z.string(),
								statusCode: z.number().int(),
								error: z.string(),
							}),
						})
						.array(),
					warning: z.string().optional(),
				}),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const browser = await getBrowser(c.env);
		const searchResults = await performSearch(
			browser,
			data.body.query,
			data.body.limit,
		);

		const promises = [];
		for (const result of searchResults) {
			promises.push(extractContent(browser, result));
		}

		const results = await Promise.all(promises);

		return {
			success: true,
			data: results,
		};
	}
}
