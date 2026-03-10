import puppeteer, { type Browser } from "@cloudflare/puppeteer";
import { NodeHtmlMarkdown } from "node-html-markdown";
import type { Env } from "./index";

export interface ExtractOptions {
	formats?: string[];
	onlyMainContent?: boolean;
	waitFor?: number;
	headers?: Record<string, string>;
}

export async function getBrowser(env: Env): Promise<Browser> {
	return await puppeteer.launch(env.BROWSER);
}

export async function extractContent(
	browser: Browser,
	url: string,
	options?: ExtractOptions,
) {
	const formats = options?.formats;
	const onlyMainContent = options?.onlyMainContent ?? true;
	const waitFor = options?.waitFor;
	const headers = options?.headers;

	const page = await browser.newPage();
	try {
		if (headers) {
			await page.setExtraHTTPHeaders(headers);
		}

		const response = await page.goto(url, { waitUntil: "domcontentloaded" });
		const statusCode = response ? response.status() : 0;

		// Attempt to close popups
		await page.evaluate(() => {
			const closeButtons = Array.from(
				document.querySelectorAll("button, a"),
			).filter(
				(el) =>
					el.textContent.toLowerCase().includes("close") ||
					el.textContent.includes("×"),
			);
			closeButtons.forEach((btn) => btn.click());
		});

		if (waitFor) {
			await page.waitForTimeout(waitFor);
		} else {
			await page.waitForTimeout(1000); // Allow popups to close
		}

		// Extract title, description, and main content
		const { title, description, content } = await page.evaluate(
			(mainOnly: boolean) => {
				const pageTitle = document.title || "No title available";

				const metaDescription = document.querySelector(
					'meta[name="description"]',
				);
				const descriptionText = metaDescription
					? metaDescription.getAttribute("content")
					: "No description available";

				const body = document.body.cloneNode(true);
				if (mainOnly) {
					body
						.querySelectorAll("script, style, nav, header, footer")
						.forEach((el) => el.remove());
				} else {
					body.querySelectorAll("script, style").forEach((el) => el.remove());
				}
				const mainContent = body.outerHTML;

				return {
					title: pageTitle,
					description: descriptionText,
					content: mainContent || "No content extracted",
				};
			},
			onlyMainContent,
		);

		const shouldInclude = (fmt: string) => !formats || formats.includes(fmt);

		const links = shouldInclude("links")
			? await page.evaluate(() => {
					const anchors = Array.from(document.querySelectorAll("a"));
					return anchors.map((a) => a.href).filter((a) => a !== "");
				})
			: null;

		const rawHtml = shouldInclude("rawHtml") ? await page.content() : null;

		const markdown = shouldInclude("markdown")
			? NodeHtmlMarkdown.translate(content, {}, undefined, undefined)
			: null;

		const html = shouldInclude("html") ? content : null;

		let screenshot: string | null = null;
		if (
			shouldInclude("screenshot") ||
			(formats && formats.includes("screenshot@fullPage"))
		) {
			const fullPage = formats
				? formats.includes("screenshot@fullPage")
				: false;
			screenshot = (await page.screenshot({
				encoding: "base64",
				fullPage,
			})) as string;
		}

		return {
			title: title,
			description: description,
			url: url,
			markdown: markdown,
			html: html,
			rawHtml: rawHtml,
			links: links,
			screenshot: screenshot,
			metadata: {
				title: title,
				description: description,
				sourceURL: url,
				statusCode: statusCode,
				error: null,
			},
		};
	} catch (error) {
		console.error(
			`Content extraction failed for ${url}: ${(error as Error).message}`,
		);
		return null;
	} finally {
		await page.close();
	}
}
