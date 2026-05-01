import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outFile = path.join(dataDir, "docs.jsonl");
const manifestFile = path.join(dataDir, "manifest.json");

const seeds = [
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/basics/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/core-concepts/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/global-settings-and-styles/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/global-settings-and-styles/settings/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/global-settings-and-styles/styles/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/templates/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/template-parts/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/patterns/" },
	{ scope: "wp-theme", url: "https://developer.wordpress.org/themes/advanced-topics/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/getting-started/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/reference-guides/block-api/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/reference-guides/packages/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/" },
	{ scope: "wp-block", url: "https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/" }
];

const scopeRules = {
	"wp-theme": {
		origin: "https://developer.wordpress.org",
		prefixes: ["/themes/"]
	},
	"wp-block": {
		origin: "https://developer.wordpress.org",
		prefixes: ["/block-editor/"]
	}
};

const maxPagesByScope = {
	"wp-theme": 80,
	"wp-block": 80
};

const userAgent = "WPDocsFinder/0.1 (+local development docs cache)";

function normalizeUrl(rawUrl, baseUrl) {
	try {
		const url = new URL(rawUrl, baseUrl);
		url.hash = "";
		url.search = "";
		if (url.pathname !== "/" && url.pathname.endsWith("/")) {
			url.pathname = url.pathname.replace(/\/+$/, "/");
		}
		return url.toString();
	} catch {
		return null;
	}
}

function isAllowed(scope, urlString) {
	const rule = scopeRules[scope];
	if (!rule) return false;

	const url = new URL(urlString);
	return url.origin === rule.origin && rule.prefixes.some((prefix) => url.pathname.startsWith(prefix));
}

function titleFromPage($) {
	const h1 = $("h1").first().text().trim();
	if (h1) return h1;

	const title = $("title").first().text().trim();
	return title.replace(/\s+[-|].*$/, "") || "Untitled";
}

function extractText($) {
	const main = $("main, article, .entry-content, .devhub-wrap, #content, body").first().clone();
	main.find("script, style, nav, header, footer, aside, svg, noscript").remove();

	const lines = [];
	main.find("h1,h2,h3,h4,h5,h6,p,li,pre,code,table").each((_, el) => {
		const tag = el.tagName.toLowerCase();
		let text = $(el).text().replace(/\s+/g, " ").trim();
		if (!text) return;
		if (/^h[1-6]$/.test(tag)) text = `${"#".repeat(Number(tag[1]))} ${text}`;
		lines.push(text);
	});

	return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractLinks($, baseUrl, scope) {
	const links = [];
	$("a[href]").each((_, el) => {
		const href = $(el).attr("href");
		const normalized = normalizeUrl(href, baseUrl);
		if (normalized && isAllowed(scope, normalized)) links.push(normalized);
	});
	return links;
}

function chunkText(text, maxChars = 1800) {
	const paragraphs = text.split(/\n{1,2}/).map((p) => p.trim()).filter(Boolean);
	const chunks = [];
	let current = "";

	for (const paragraph of paragraphs) {
		if ((current + "\n" + paragraph).length > maxChars && current) {
			chunks.push(current.trim());
			current = "";
		}
		current += `${current ? "\n" : ""}${paragraph}`;
	}

	if (current.trim()) chunks.push(current.trim());
	return chunks;
}

async function fetchPage(url) {
	const response = await fetch(url, {
		headers: {
			"User-Agent": userAgent,
			Accept: "text/html,application/xhtml+xml"
		}
	});

	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	return response.text();
}

async function collectScope(scope) {
	const queue = seeds.filter((seed) => seed.scope === scope).map((seed) => seed.url);
	const seen = new Set();
	const pages = [];
	const maxPages = maxPagesByScope[scope] ?? 50;

	while (queue.length && seen.size < maxPages) {
		const url = queue.shift();
		if (!url || seen.has(url) || !isAllowed(scope, url)) continue;
		seen.add(url);

		try {
			const html = await fetchPage(url);
			const $ = cheerio.load(html);
			const title = titleFromPage($);
			const text = extractText($);

			if (text.length > 200) {
				pages.push({ scope, url, title, text });
			}

			for (const link of extractLinks($, url, scope)) {
				if (!seen.has(link) && queue.length < maxPages * 4) queue.push(link);
			}

			process.stderr.write(`fetched ${scope}: ${url}\n`);
		} catch (error) {
			process.stderr.write(`skip ${scope}: ${url} (${error.message})\n`);
		}
	}

	return pages;
}

async function main() {
	await mkdir(dataDir, { recursive: true });

	const scopes = [...new Set(seeds.map((seed) => seed.scope))];
	const pages = [];

	for (const scope of scopes) {
		pages.push(...await collectScope(scope));
	}

	const records = [];
	for (const page of pages) {
		const chunks = chunkText(page.text);
		chunks.forEach((content, index) => {
			records.push({
				id: `${page.scope}:${Buffer.from(page.url).toString("base64url")}:${index + 1}`,
				scope: page.scope,
				url: page.url,
				title: page.title,
				chunk: index + 1,
				chunks: chunks.length,
				content
			});
		});
	}

	await writeFile(outFile, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
	await writeFile(manifestFile, JSON.stringify({
		generatedAt: new Date().toISOString(),
		pages: pages.length,
		chunks: records.length,
		scopes
	}, null, 2) + "\n");

	process.stdout.write(`Wrote ${records.length} chunks from ${pages.length} pages to ${outFile}\n`);
}

main().catch((error) => {
	process.stderr.write(`${error.stack || error.message}\n`);
	process.exit(1);
});
