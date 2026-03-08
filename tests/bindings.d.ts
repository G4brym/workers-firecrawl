export type Env = {
	BROWSER: Fetcher;
	AUTHORIZATION_KEY?: string;
};

declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {}
}
