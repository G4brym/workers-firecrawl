import { fromHono } from "chanfana";
import { type Context, Hono } from "hono";
import { WebSearch } from "./webSearch";

export type Env = {
	BROWSER: Fetcher;
};
export type AppContext = Context<{ Bindings: Env }>;

// Start a Hono app
const app = new Hono();

// Setup OpenAPI registry
const openapi = fromHono(app, { docs_url: "/" });

// Register OpenAPI endpoints (this will also register the routes in Hono)
openapi.post("/v1/search", WebSearch);

// Export the Hono app
export default app;
