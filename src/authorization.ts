import type { AppContext } from "./index";

export async function authorizationMiddleware(
	c: AppContext,
	next: CallableFunction,
) {
	if (
		c.env.AUTHORIZATION_KEY &&
		c.req.header("authorization") !== `Bearer ${c.env.AUTHORIZATION_KEY}`
	) {
		return Response.json(
			{ success: false, error: "Unauthorized: Invalid token" },
			{ status: 401 },
		);
	}

	await next();
}
