# workers-firecrawl

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/G4brym/workers-firecrawl)

## Overview

`workers-firecrawl` is a Cloudflare Workers implementation of the Firecrawl API, specifically designed to replicate the
`/search` endpoint. It uses Cloudflare's Browser Rendering API to perform web searches and extract content from web
pages, all within the Cloudflare environment. This project enables developers to self-host a Firecrawl-compatible search
service with minimal setup.

## Purpose

This project focuses on providing a lightweight, self-hosted alternative to Firecrawl’s `/search` endpoint. By
leveraging Cloudflare Workers, it offers a simple API interface for web search capabilities, making it an ideal drop-in
replacement for existing Firecrawl SDK integrations. Update just one line in your codebase to point to your Worker, and
you’re ready to go!

## Features

- **`/search` Endpoint**: Perform web searches and retrieve structured results, compatible with Firecrawl SDKs.
- **`/map` Endpoint**: Discover all URLs on a website by extracting links from the page and optionally parsing its sitemap.xml.
- **`/scrape` Endpoint**: Scrape a single URL and extract content in multiple formats (markdown, HTML, links, screenshot).
- **Cloudflare Browser Rendering**: Powers real-time web scraping and content extraction.
- **Firecrawl SDK Compatibility**: Seamlessly integrates with existing Firecrawl-based applications.
- **Format Filtering**: Request only the content formats you need via `scrapeOptions.formats` to reduce payload size and improve performance.
- **Screenshot Capture**: Capture viewport or full-page screenshots of search results as base64 data URIs.

Additional endpoints or features can be requested
via [GitHub Issues](https://github.com/G4brym/workers-firecrawl/issues).

### Supported `scrapeOptions.formats`

The `/v1/search` endpoint supports the `scrapeOptions.formats` parameter to control which content formats are returned per result. When omitted, the default formats are `["markdown", "html", "rawHtml", "links"]`.

| Format | Description |
|---|---|
| `markdown` | Page content converted to Markdown |
| `html` | Cleaned HTML content (scripts, styles, nav, header, footer removed) |
| `rawHtml` | Full raw HTML of the page |
| `links` | Array of all link URLs found on the page |
| `screenshot` | Viewport screenshot as a `data:image/png;base64,...` data URI |
| `screenshot@fullPage` | Full-page screenshot as a `data:image/png;base64,...` data URI |
| `extract` | Accepted by the schema but not yet implemented (requires LLM integration) |

**Example — request only markdown:**

```javascript
const results = await firecrawl.search('test query', {
    scrapeOptions: { formats: ['markdown'] }
});
```

**Example — request markdown with a screenshot:**

```javascript
const results = await firecrawl.search('test query', {
    scrapeOptions: { formats: ['markdown', 'screenshot'] }
});
```

## Basic Usage

### Prerequisites

- A Cloudflare account with a [Workers Paid Plan](https://developers.cloudflare.com/workers/platform/pricing/) ($
  5/month) to use Browser Rendering.

### Setup for Local Development

1. **Clone the Repository**

   ```bash
   git clone git@github.com:G4brym/workers-firecrawl.git
   cd workers-firecrawl
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Log in to Cloudflare**

   Authenticate with your Cloudflare account:

   ```bash
   npx wrangler login
   ```

4. **Deploy the Worker**

   Deploy to Cloudflare:

   ```bash
   npx wrangler deploy
   ```

   After deployment, you’ll see a URL in your terminal, e.g., `https://workers-firecrawl.{your-user}.workers.dev`. This
   is your Worker’s endpoint.

5. **Test the Worker**

   Open the URL in your browser to access a Swagger UI for testing the `/search` endpoint directly. Use this URL in your
   Firecrawl SDK configuration.

6. **Authorization (Optional)**

   By default, this worker will accept requests from everyone, so its recommended that you setup authorization,
   For this, just set the `AUTHORIZATION_KEY` secret in your worker, with the desired api key you want to use.

   ```bash
   npx wrangler secret put AUTHORIZATION_KEY
   ```

### Making Requests

Integrate with the Firecrawl SDK by updating the `apiUrl` to your Worker’s URL:

```javascript
const {FirecrawlApp} = require('@mendable/firecrawl-js');

const firecrawl = new FirecrawlApp({
    apiKey: 'your-api-key', // Only if AUTHORIZATION_KEY is defined in the worker
    apiUrl: 'https://workers-firecrawl.{your-user}.workers.dev'
});

// Example search
const results = await firecrawl.search('test query');
console.log(results);

// Example map — discover all URLs on a website
const mapResult = await firecrawl.map('https://example.com');
console.log(mapResult);

// Example scrape
const result = await firecrawl.scrapeUrl('https://example.com', {
    formats: ['markdown', 'links'],
});
console.log(result);
```

### Customization

- **Custom Domain**: Assign a custom domain via the Cloudflare dashboard under Workers > Your Worker > Triggers.
- **Cloudflare Access**: Add security by configuring Cloudflare Access for authenticated access under Access >
  Applications.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
