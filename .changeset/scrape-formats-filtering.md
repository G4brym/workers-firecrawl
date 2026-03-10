---
"workers-firecrawl": minor
---

Honor scrapeOptions.formats filtering and add screenshot capture

- Implement format filtering in /v1/search so only client-requested content formats are returned
- Add screenshot and screenshot@fullPage capture using Puppeteer's page.screenshot()
- Skip expensive processing (markdown conversion, raw HTML, link extraction) when not requested
- Response objects now only include requested format fields, reducing payload size
