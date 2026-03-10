import { Hono } from "hono";
import { OpenAPIRoute, fromHono } from "chanfana";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/index";
import { z } from "zod";

// Stub endpoint using the same schema as the real WebScrape endpoint
// to test request validation without importing puppeteer/node-html-markdown
class StubScrapeEndpoint extends OpenAPIRoute {
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
	};

	async handle() {
		const data = await this.getValidatedData<typeof this.schema>();
		return {
			success: true,
			data: {
				markdown: null,
				html: null,
				rawHtml: null,
				links: null,
				screenshot: null,
				metadata: {
					title: "Test",
					description: "Test",
					sourceURL: data.body.url,
					statusCode: 200,
					error: null,
				},
			},
		};
	}
}

function createApp() {
	const app = new Hono<{ Bindings: Env }>();
	const openapi = fromHono(app, { docs_url: "/" });
	openapi.post("/v1/scrape", StubScrapeEndpoint);
	return app;
}

describe("Scrape Endpoint Validation", () => {
	const env = {};

	it("accepts valid request with URL only", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://example.com" }),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("accepts valid request with URL and formats", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					formats: ["markdown", "links"],
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("accepts valid request with all optional parameters", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					formats: ["markdown", "html", "rawHtml", "links", "screenshot"],
					onlyMainContent: false,
					waitFor: 5000,
					headers: { "User-Agent": "CustomBot/1.0" },
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("rejects request with missing URL", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects request with invalid URL", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "not-a-valid-url" }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects request with waitFor exceeding maximum (30000)", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					waitFor: 50000,
				}),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects request with invalid format string", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/scrape",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					formats: ["invalidFormat"],
				}),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});
});
