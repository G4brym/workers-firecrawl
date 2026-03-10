import { Hono } from "hono";
import { OpenAPIRoute, fromHono } from "chanfana";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/index";
import { DEFAULT_FORMATS } from "../../src/constants";
import { z } from "zod";

// Stub endpoint using the same schema as the real WebSearch endpoint
// to test request validation without importing puppeteer/node-html-markdown
class StubSearchEndpoint extends OpenAPIRoute {
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
	};

	async handle() {
		const data = await this.getValidatedData<typeof this.schema>();
		const formats = data.body.scrapeOptions?.formats ?? [
			...DEFAULT_FORMATS,
		];
		return {
			success: true,
			data: [],
			query: data.body.query,
			limit: data.body.limit,
			formats: formats,
		};
	}
}

function createApp() {
	const app = new Hono<{ Bindings: Env }>();
	const openapi = fromHono(app, { docs_url: "/" });
	openapi.post("/v1/search", StubSearchEndpoint);
	return app;
}

describe("Search Endpoint Validation", () => {
	const env = {};

	it("accepts valid request with query", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "cloudflare workers" }),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("accepts valid request with query and limit", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "test", limit: 3 }),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("rejects request with empty JSON body", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
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

	it("rejects request with limit exceeding maximum (10)", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "test", limit: 100 }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects request with limit below minimum (1)", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "test", limit: 0 }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("accepts valid optional fields", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					lang: "de",
					country: "de",
					scrapeOptions: { formats: ["markdown", "html"] },
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});
});

describe("Format Filtering Validation", () => {
	const env = {};

	it("accepts request with specific formats and echoes them back", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					scrapeOptions: { formats: ["markdown"] },
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.formats).toEqual(["markdown"]);
	});

	it("accepts request with screenshot format", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					scrapeOptions: { formats: ["screenshot"] },
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.formats).toEqual(["screenshot"]);
	});

	it("accepts request with screenshot@fullPage format", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					scrapeOptions: { formats: ["screenshot@fullPage"] },
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.formats).toEqual(["screenshot@fullPage"]);
	});

	it("accepts request with multiple formats", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					scrapeOptions: { formats: ["markdown", "html", "screenshot"] },
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.formats).toEqual(["markdown", "html", "screenshot"]);
	});

	it("rejects request with invalid format", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					scrapeOptions: { formats: ["invalid"] },
				}),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("returns default formats when scrapeOptions is omitted", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "test" }),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.formats).toEqual(DEFAULT_FORMATS);
	});

	it("returns default formats when formats array is omitted from scrapeOptions", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/search",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "test",
					scrapeOptions: {},
				}),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.formats).toEqual(DEFAULT_FORMATS);
	});
});
