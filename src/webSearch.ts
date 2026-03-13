import type { Browser } from "@cloudflare/puppeteer";
import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { extractContent, getBrowser } from "./browser";
import { DEFAULT_FORMATS } from "./constants";
import type { AppContext } from "./index";

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
							markdown: z.string().optional(),
							html: z.string().optional(),
							rawHtml: z.string().optional(),
							links: z.string().array().optional(),
							screenshot: z.string().optional().nullable(),
							metadata: z.object({
								title: z.string(),
								description: z.string(),
								sourceURL: z.string(),
								statusCode: z.number().int(),
								error: z.string().nullable(),
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
		const formats = data.body.scrapeOptions?.formats ?? [...DEFAULT_FORMATS];

		const browser = await getBrowser(c.env);
		try {
			const searchResults = await performSearch(
				browser,
				data.body.query,
				data.body.limit,
			);

			const promises = [];
			for (const result of searchResults) {
				promises.push(extractContent(browser, result, { formats }));
			}

			const results = await Promise.all(promises);

			return {
				success: true,
				data: results.filter((obj) => obj !== null),
			};
		} finally {
			await browser.close();
		}
	}
}
