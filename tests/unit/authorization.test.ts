import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { authorizationMiddleware } from "../../src/authorization";
import type { Env } from "../../src/index";

function createApp() {
	const app = new Hono<{ Bindings: Env }>();
	app.use("*", authorizationMiddleware);
	app.all("*", (c) => c.json({ success: true }));
	return app;
}

describe("Authorization Middleware", () => {
	describe("when AUTHORIZATION_KEY is configured", () => {
		const env = { AUTHORIZATION_KEY: "test-secret-key" };

		it("rejects requests without Authorization header", async () => {
			const app = createApp();
			const res = await app.request("/", { method: "GET" }, env);

			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.success).toBe(false);
			expect(body.error).toContain("Unauthorized");
		});

		it("rejects requests with invalid Bearer token", async () => {
			const app = createApp();
			const res = await app.request(
				"/",
				{
					method: "GET",
					headers: { Authorization: "Bearer wrong-key" },
				},
				env,
			);

			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.success).toBe(false);
		});

		it("rejects requests with malformed Authorization header", async () => {
			const app = createApp();
			const res = await app.request(
				"/",
				{
					method: "GET",
					headers: { Authorization: "test-secret-key" },
				},
				env,
			);

			expect(res.status).toBe(401);
		});

		it("allows requests with valid Bearer token", async () => {
			const app = createApp();
			const res = await app.request(
				"/",
				{
					method: "GET",
					headers: { Authorization: "Bearer test-secret-key" },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
		});
	});

	describe("when AUTHORIZATION_KEY is not configured", () => {
		const env = {};

		it("allows all requests without any auth header", async () => {
			const app = createApp();
			const res = await app.request("/", { method: "GET" }, env);

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
		});

		it("allows requests even with an arbitrary auth header", async () => {
			const app = createApp();
			const res = await app.request(
				"/",
				{
					method: "GET",
					headers: { Authorization: "Bearer anything" },
				},
				env,
			);

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
		});
	});
});
