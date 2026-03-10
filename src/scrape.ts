import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { extractContent, getBrowser } from "./browser";
import type { AppContext } from "./index";

export class WebScrape extends OpenAPIRoute {
	schema = {
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							url: z.string().url(),
							formats: z
								.enum([
									"markdown",
									"html",
									"rawHtml",
									"links",
									"screenshot",
									"screenshot@fullPage",
								])
								.array()
								.optional(),
							onlyMainContent: z.boolean().default(true).optional(),
							waitFor: z.number().min(0).max(30000).optional(),
							timeout: z.number().default(60000).optional(),
							headers: z.record(z.string()).optional(),
						}),
					},
				},
			},
		},
		responses: {
			200: {
				description: "Scraped content from the provided URL",
				...contentJson({
					success: z.boolean(),
					data: z.object({
						markdown: z.string().nullable(),
						html: z.string().nullable(),
						rawHtml: z.string().nullable(),
						links: z.string().array().nullable(),
						screenshot: z.string().nullable(),
						metadata: z.object({
							title: z.string(),
							description: z.string(),
							sourceURL: z.string(),
							statusCode: z.number().int(),
							error: z.string().nullable(),
						}),
					}),
				}),
			},
			422: {
				description: "Failed to scrape the provided URL",
				...contentJson({
					success: z.literal(false),
					error: z.string(),
				}),
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const browser = await getBrowser(c.env);
		try {
			const result = await extractContent(browser, data.body.url, {
				formats: data.body.formats,
				onlyMainContent: data.body.onlyMainContent,
				waitFor: data.body.waitFor,
				timeout: data.body.timeout,
				headers: data.body.headers,
			});

			if (!result) {
				return Response.json(
					{ success: false, error: "Failed to scrape URL" },
					{ status: 422 },
				);
			}

			return {
				success: true,
				data: {
					markdown: result.markdown,
					html: result.html,
					rawHtml: result.rawHtml,
					links: result.links,
					screenshot: result.screenshot,
					metadata: result.metadata,
				},
			};
		} finally {
			await browser.close();
		}
	}
}
