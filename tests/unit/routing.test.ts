import { Hono } from "hono";
import { fromHono } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import { describe, expect, it } from "vitest";
import { authorizationMiddleware } from "../../src/authorization";
import type { Env } from "../../src/index";
import { z } from "zod";

// Minimal stub endpoint that mimics WebSearch schema validation without
// importing the real WebSearch (which pulls in node-html-markdown/puppeteer)
class StubSearchEndpoint extends OpenAPIRoute {
	schema = {
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							query: z.string(),
							limit: z.number().min(1).max(10).default(5).optional(),
						}),
					},
				},
			},
		},
	};

	async handle() {
		return { success: true, data: [] };
	}
}

class StubScrapeEndpoint extends OpenAPIRoute {
	schema = {
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							url: z.string().url(),
						}),
					},
				},
			},
		},
	};

	async handle() {
		return { success: true, data: {} };
	}
}

function createApp() {
	const app = new Hono<{ Bindings: Env }>();
	app.use("*", authorizationMiddleware);
	const openapi = fromHono(app, { docs_url: "/" });
	openapi.post("/v1/search", StubSearchEndpoint);
	openapi.post("/v1/scrape", StubScrapeEndpoint);
	return app;
}

describe("App Routing", () => {
	const env = {};

	it("serves OpenAPI docs at GET /", async () => {
		const app = createApp();
		const res = await app.request("/", { method: "GET" }, env);

		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("html");
	});

	it("returns 404 for unknown routes", async () => {
		const app = createApp();
		const res = await app.request("/unknown", { method: "GET" }, env);

		expect(res.status).toBe(404);
	});

	it("returns 404 for GET /v1/search (only POST is registered)", async () => {
		const app = createApp();
		const res = await app.request("/v1/search", { method: "GET" }, env);

		expect(res.status).toBe(404);
	});

	it("handles POST /v1/search route", async () => {
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
		expect(body.success).toBe(true);
	});

	it("handles POST /v1/scrape route", async () => {
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

	it("returns 404 for GET /v1/scrape (only POST is registered)", async () => {
		const app = createApp();
		const res = await app.request("/v1/scrape", { method: "GET" }, env);

		expect(res.status).toBe(404);
	});
});
