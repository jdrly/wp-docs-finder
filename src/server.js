#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, "../data/docs.jsonl");

let docsCache = null;

async function loadDocs() {
	if (docsCache) return docsCache;

	const raw = await readFile(dataFile, "utf8");
	docsCache = raw
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
	return docsCache;
}

function tokenize(text) {
	return String(text)
		.toLowerCase()
		.replace(/[^a-z0-9_/-]+/g, " ")
		.split(/\s+/)
		.filter((token) => token.length > 1);
}

function scoreDoc(doc, queryTokens) {
	const title = tokenize(doc.title);
	const url = tokenize(doc.url);
	const content = tokenize(doc.content);
	const titleSet = new Set(title);
	const urlSet = new Set(url);
	const contentSet = new Set(content);
	let score = 0;

	for (const token of queryTokens) {
		if (titleSet.has(token)) score += 8;
		if (urlSet.has(token)) score += 4;
		if (contentSet.has(token)) score += 2;
		score += content.filter((word) => word === token).length * 0.25;
	}

	return score;
}

function excerpt(content, queryTokens, maxLength = 520) {
	const lower = content.toLowerCase();
	const hitIndex = queryTokens
		.map((token) => lower.indexOf(token))
		.filter((index) => index >= 0)
		.sort((a, b) => a - b)[0] ?? 0;
	const start = Math.max(0, hitIndex - 160);
	const snippet = content.slice(start, start + maxLength).replace(/\s+/g, " ").trim();
	return `${start > 0 ? "..." : ""}${snippet}${start + maxLength < content.length ? "..." : ""}`;
}

function filterScope(docs, scope) {
	if (!scope || scope === "all") return docs;
	return docs.filter((doc) => doc.scope === scope);
}

const server = new McpServer({
	name: "WP Docs Finder",
	version: "0.1.0"
});

server.registerTool(
	"search_docs",
	{
		title: "Search Local Docs",
		description: "Search cached official WordPress theme and block editor docs.",
		inputSchema: {
			query: z.string().min(2).describe("Search query."),
			scope: z.enum(["all", "wp-theme", "wp-block"]).optional().describe("Docs scope."),
			limit: z.number().int().min(1).max(20).optional().describe("Maximum results.")
		}
	},
	async ({ query, scope = "all", limit = 8 }) => {
		const docs = filterScope(await loadDocs(), scope);
		const queryTokens = tokenize(query);
		const results = docs
			.map((doc) => ({ doc, score: scoreDoc(doc, queryTokens) }))
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(({ doc, score }) => ({
				id: doc.id,
				scope: doc.scope,
				title: doc.title,
				url: doc.url,
				chunk: doc.chunk,
				chunks: doc.chunks,
				score,
				excerpt: excerpt(doc.content, queryTokens)
			}));

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ results }, null, 2)
				}
			],
			structuredContent: { results }
		};
	}
);

server.registerTool(
	"get_doc",
	{
		title: "Get Local Doc Chunk",
		description: "Return a cached docs chunk by id from search_docs.",
		inputSchema: {
			id: z.string().describe("Chunk id returned by search_docs.")
		}
	},
	async ({ id }) => {
		const docs = await loadDocs();
		const doc = docs.find((item) => item.id === id);

		if (!doc) {
			return {
				isError: true,
				content: [{ type: "text", text: `Doc chunk not found: ${id}` }]
			};
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(doc, null, 2)
				}
			],
			structuredContent: doc
		};
	}
);

server.registerTool(
	"list_doc_scopes",
	{
		title: "List Doc Scopes",
		description: "List cached documentation scopes and counts.",
		inputSchema: {}
	},
	async () => {
		const docs = await loadDocs();
		const scopes = {};

		for (const doc of docs) {
			scopes[doc.scope] ??= { chunks: 0, urls: new Set() };
			scopes[doc.scope].chunks += 1;
			scopes[doc.scope].urls.add(doc.url);
		}

		const result = Object.fromEntries(
			Object.entries(scopes).map(([scope, value]) => [
				scope,
				{ chunks: value.chunks, pages: value.urls.size }
			])
		);

		return {
			content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			structuredContent: { scopes: result }
		};
	}
);

await server.connect(new StdioServerTransport());
