import { Hono } from "hono";
import { OpenAPIRoute, fromHono } from "chanfana";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/index";
import { z } from "zod";

// Stub endpoint using the same schema as the real WebMap endpoint
// to test request validation without importing puppeteer
class StubMapEndpoint extends OpenAPIRoute {
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
	};

	async handle() {
		const data = await this.getValidatedData<typeof this.schema>();
		return {
			success: true,
			links: [],
		};
	}
}

function createApp() {
	const app = new Hono<{ Bindings: Env }>();
	const openapi = fromHono(app, { docs_url: "/" });
	openapi.post("/v1/map", StubMapEndpoint);
	return app;
}

describe("Map Endpoint Validation", () => {
	const env = {};

	it("accepts valid request with just url", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
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

	it("accepts valid request with url and limit", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://example.com", limit: 100 }),
			},
			env,
		);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
	});

	it("accepts valid request with all optional fields", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					search: "blog",
					ignoreSitemap: true,
					includeSubdomains: true,
					limit: 500,
				}),
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
			"/v1/map",
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

	it("rejects request without url field", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ search: "test" }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects invalid URL format", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "not-a-url" }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects limit exceeding maximum (5000)", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://example.com", limit: 10000 }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("rejects limit below minimum (1)", async () => {
		const app = createApp();
		const res = await app.request(
			"/v1/map",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://example.com", limit: 0 }),
			},
			env,
		);

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it("returns 404 for GET /v1/map (only POST allowed)", async () => {
		const app = createApp();
		const res = await app.request("/v1/map", { method: "GET" }, env);

		expect(res.status).toBe(404);
	});
});
