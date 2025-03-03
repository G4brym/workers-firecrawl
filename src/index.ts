import { fromHono } from "chanfana";
import { type Context, Hono } from "hono";
import { authorizationMiddleware } from "./authorization";
import { WebSearch } from "./webSearch";

export type Env = {
	BROWSER: Fetcher;
	AUTHORIZATION_KEY?: string;
};
export type AppContext = Context<{ Bindings: Env }>;

// Start a Hono app
const app = new Hono();
app.use("*", authorizationMiddleware);

// Setup OpenAPI registry
const openapi = fromHono(app, { docs_url: "/" });

// Register OpenAPI endpoints (this will also register the routes in Hono)
openapi.post("/v1/search", WebSearch);

// Export the Hono app
export default app;
