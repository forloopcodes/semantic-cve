# Semantic CVE

**Todos**

- [ ] Test MCP server
- [ ] Publish MCP server to npm

Describe a vulnerability in plain English. Find every relevant CVE.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=fff)](https://bun.sh)
[![Turbo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=fff)](https://turbo.build)
[![Fastify](https://img.shields.io/badge/Fastify-000?logo=fastify&logoColor=fff)](https://fastify.dev)
[![Next.js](https://img.shields.io/badge/Next.js-000?logo=next.js&logoColor=fff)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=fff)](https://sqlite.org)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=fff)](https://pages.cloudflare.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

Semantic CVE is a vulnerability intelligence platform that combines local [Ollama](https://ollama.com) embeddings with full-text and regex search across the entire CVE database (354k+ records). Instead of keyword matching, you describe what you're looking for in natural language and the platform finds semantically similar CVEs.

The project ships as three deployable applications — a **Fastify API**, a **Next.js frontend**, and an **MCP server** for AI agent tool integration — orchestrated as a Turborepo monorepo.

## Features

- **Semantic search** — Describe a vulnerability naturally (e.g. _"Windows privilege escalation using symbolic links"_) and get relevant CVEs ranked by cosine similarity against 1024-dim Ollama embeddings
- **Full-text search** — SQLite FTS5-based search on description, vendor, product, and CWE fields
- **Regex search** — SQLite REGEXP pattern matching for power users
- **Hybrid search** — Weighted combination of semantic (70%) + full-text (30%) for best results by default
- **MCP server** — Exposes all search capabilities as MCP tools for AI agent (Claude, Cursor, etc.) integration
- **Similar CVEs** — For any CVE, find semantically similar ones via in-memory cosine similarity against the full vector store
- **Daily sync** — Incremental sync from [cvelistV5](https://github.com/CVEProject/cvelistV5) with SHA256 change tracking; only re-embeds what changed
- **Synthetic document embedding** — Combines CVE description, vendor, product, CWE, severity, and affected versions into a single document before embedding, dramatically improving match quality

## Architecture

```
User query (plain English)
       │
       ▼
┌──────────────────────────────────────────────────────┐
│                    search query                       │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐ │
│  │ Semantic  │  │ Full-text│  │ Regex  │  │ Hybrid │ │
│  │ (Ollama   │  │ (FTS5)   │  │ (LIKE) │  │ 0.7/+  │ │
│  │  cosine)  │  │          │  │        │  │ 0.3    │ │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  └────┬───┘ │
│       │             │            │            │     │
│       └─────────────┴────────────┴────────────┘     │
│                              │                       │
│                              ▼                       │
│                    ┌─────────────────┐               │
│                    │   SQLite DB     │               │
│                    │  (better-sqlite3)│               │
│                    │  CVEs │ Vectors  │               │
│                    │  FTS  │ Hashes   │               │
│                    └─────────────────┘               │
└──────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
           ┌──────────────┐    ┌──────────────┐
           │  Fastify API  │    │  MCP Server   │
           │  (port 4000)  │    │  (stdio)      │
           └──────┬───────┘    └──────┬───────┘
                  │                   │
                  ▼                   ▼
          ┌──────────────┐    ┌──────────────┐
          │  Next.js 15   │    │  AI Agents   │
          │  (port 3000)  │    │  (Claude etc)│
          └──────────────┘    └──────────────┘
```

### Repository Structure

```
semantic-cve/
├── apps/
│   ├── web/          # Next.js 15 frontend (Tailwind v4)
│   ├── api/          # Fastify TypeScript API server
│   └── mcp/          # MCP server (stdio JSON-RPC 2.0)
├── packages/
│   ├── shared/       # Types, constants, enums
│   ├── db/           # SQLite schema, queries, better-sqlite3
│   ├── cve-parser/   # cvelistV5 JSON parser + synthetic doc builder
│   ├── embeddings/   # Ollama embedding client (single + batch)
│   ├── search/       # Four search engine implementations
│   └── vector-store/ # Float32Array ops, cosine similarity
├── scripts/
│   ├── sync-cves.ts      # Clone/pull cvelistV5, SHA256 tracking
│   ├── embed-cves.ts     # Batch-embed CVEs into vector store
│   ├── daily-update.ts   # Cron entry point: sync → embed
│   ├── inspect.ts        # DB inspection utility
│   ├── drop-embeddings.ts# Reset embedding state
│   ├── fix-cveids.ts     # Repair CVE ID mismatches
│   └── speedtest.ts      # Search performance benchmarking
├── turbo.json            # Turborepo build orchestration
└── package.json          # Bun workspace root
```

## Apps

### `apps/web` — Next.js 15 Frontend

Next.js 15 static export with Tailwind CSS v4, consumed by Cloudflare Pages via `NEXT_PUBLIC_API_URL`.

| Route | Purpose |
| --- | --- |
| `/` | Hero search bar with example query chips |
| `/search?q=&mode=` | Search results with pagination and mode selector |
| `/cve?id=` | CVE detail with metadata, similar CVEs, references, raw JSON (query-param for static export) |

```bash
bun run --filter @semantic-cve/web dev       # development on :3000
bun run --filter @semantic-cve/web build     # static export to apps/web/out/
bun run --filter @semantic-cve/web deploy    # wrangler deploy to Cloudflare Pages
```

### `apps/api` — Fastify TypeScript API

Fastify 5 server with CORS enabled, serving as the backend for both the web frontend and direct HTTP clients. Routes are registered under the `/api` prefix.

**Routes:**

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check returning `{ status, timestamp }` |
| `GET` | `/api/search?query=&mode=&limit=&offset=&cvssMin=&cvssMax=&cwe=&vendor=&product=` | Search CVEs across all four modes |
| `GET` | `/api/cves/:id` | Single CVE detail by CVE ID |
| `GET` | `/api/cves/:id/similar?limit=` | Semantically similar CVEs via vector proximity |
| `GET` | `/api/cves?days=&limit=&offset=` | Latest CVEs filtered by recency |

**Search query parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | string | — | **Required.** Natural language or keyword query |
| `mode` | string | `hybrid` | One of: `semantic`, `fulltext`, `regex`, `hybrid` |
| `limit` | number | `20` | Max results to return |
| `offset` | number | `0` | Result offset for pagination |
| `cvssMin` | number | — | Minimum CVSS score filter |
| `cvssMax` | number | — | Maximum CVSS score filter |
| `cwe` | string | — | CWE ID filter (e.g. `CWE-79`) |
| `vendor` | string | — | Vendor name filter |
| `product` | string | — | Product name filter |

**Dependencies:** `fastify@5`, `@fastify/cors`, `@semantic-cve/search`, `@semantic-cve/db`, `@semantic-cve/shared`

```bash
bun run --filter @semantic-cve/api dev      # development on :4000 (hot reload via tsx watch)
bun run --filter @semantic-cve/api build    # tsc compilation
```

### `apps/mcp` — MCP Server

The MCP (Model Context Protocol) server exposes CVE search as AI agent tools over stdio JSON-RPC 2.0. It is framework-free with zero external MCP SDK dependencies — the protocol is implemented in ~160 lines of TypeScript.

**How it works:**

The server reads JSON-RPC requests from `stdin`, processes them, and writes responses to `stdout`. It implements three protocol methods:

1. **`initialize`** — Handshake returning protocol version, server capabilities, and server metadata
2. **`tools/list`** — Returns the full tool schema definitions (names, descriptions, input JSON Schemas)
3. **`tools/call`** — Dispatches tool invocations to the underlying search/DB functions

**Available Tools:**

| Tool | Input | Returns | Implementation |
| --- | --- | --- | --- |
| `search_cves` | `{ query: string, mode?: 'semantic'\|'fulltext'\|'regex'\|'hybrid', limit?: number }` | Ranked CVE results with similarity scores and match types | Delegates to `@semantic-cve/search` |
| `get_cve` | `{ id: string }` | Full CVE detail including description, CVSS, vendor, product, references | Calls `getCveById()` from `@semantic-cve/db` |
| `related_cves` | `{ id: string, limit?: number }` | Semantically similar CVEs via vector proximity | Loads source CVE embedding, runs in-memory `topK` against all other vectors |
| `search_by_product` | `{ vendor?: string, product?: string, limit?: number }` | CVEs matching vendor/product | SQL `LIKE` query via `searchByVendorProduct()` |
| `search_by_cwe` | `{ cwe: string, limit?: number }` | CVEs matching a CWE ID | Direct SQL lookup via `searchByCwe()` |
| `latest_cves` | `{ days?: number }` | Recent CVEs from last N days | Date-filtered query via `getLatestCves()` |

**Integration with AI agents:**

The MCP server can be configured as a tool provider in any MCP-compatible client:

```json
{
  "mcpServers": {
    "semantic-cve": {
      "command": "bun",
      "args": ["run", "--filter", "@semantic-cve/mcp", "dev"],
      "cwd": "/path/to/semantic-cve"
    }
  }
}
```

**Dependencies:** `@semantic-cve/search`, `@semantic-cve/db`, `@semantic-cve/shared` (zero additional runtime dependencies)

```bash
bun run --filter @semantic-cve/mcp dev      # development (restarts on file changes)
bun run --filter @semantic-cve/mcp build    # tsc compilation
```

## Packages

### `packages/shared`

Shared TypeScript types, constants, and enums used across all apps and packages.

**Exports:**
- `CveRecord` — Full CVE database row type
- `SearchResult` — Search result with score, match type, and CVE data
- `SearchQuery` — Standardized search query parameters
- `EMBEDDING_DIMENSION` — `1024` (matches `qwen3-embedding:0.6b`)
- `EMBEDDING_MODEL` — `'qwen3-embedding:0.6b'`
- `HYBRID_WEIGHTS` — `{ semantic: 0.7, fts: 0.3 }`
- `CVE_CACHE_DIR` / `CVE_LIST_REPO` — Path and repo constants for sync scripts

### `packages/db`

SQLite database layer using `better-sqlite3`. Provides schema initialization (via automatic migration on first connection), query functions, and connection management.

**Schema:**

| Table | Purpose |
| --- | --- |
| `cves` | Core CVE metadata: CVE ID, description, CWE, vendor, product, affected versions, CVSS score/severity, dates, raw JSON |
| `cve_fts` | FTS5 virtual table over `cves` for full-text search on description, vendor, product, and CWE |
| `embeddings` | BLOB vector storage (1024-dim Float32Array per CVE) |
| `references_` | CVE reference URLs with source and tags |
| `hashes` | SHA256 hashes for incremental sync change tracking |

**Key queries:**
- `upsertCve()` / `getCveById()` / `getCvesByIds()` — CRUD operations
- `searchFts()` — FTS5 full-text search with rank ordering
- `searchRegex()` — REGEXP pattern matching on description/vendor/product
- `searchSemantic()` — Loads all vectors, runs `topK` cosine similarity
- `getSimilarCves()` — Loads source CVE vector, compares against all others
- `upsertEmbedding()` / `getHash()` / `upsertHash()` — Embedding and sync state management

**Triggers:** Automatic FTS sync on CVE insert/update/delete via `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` triggers.

### `packages/cve-parser`

Parses CVE JSON files from the [cvelistV5](https://github.com/CVEProject/cvelistV5) repository format.

**Exports:**
- `parseCveFile(raw: string)` — Parses a CVE JSON string into structured fields: CVE ID, description, CWE, vendor, product, affected versions, CVSS score/severity, dates, references
- `syntheticDoc(parsed)` — Generates a combined embedding document from all fields: `"CVE-2025-1234 Vendor: Apache Product: HTTP Server CWE: CWE-287 Severity: Critical Description: ... Affected Versions: 2.4.0 - 2.4.59"`

The synthetic document approach dramatically improves semantic matching over description-only embeddings by encoding vendor, product, CWE, and severity context directly into the vector space.

### `packages/embeddings`

Ollama embedding client. Connects to a local Ollama instance to generate 1024-dim embeddings.

**Exports:**
- `embed(text)` — Single text embedding via `POST /api/embeddings`
- `embedBatch(texts)` — Batch embedding via `POST /api/embed` (supports multiple inputs per request)
- `healthCheck()` — Checks if Ollama is reachable via `GET /api/tags`

Configured via `OLLAMA_URL` environment variable (default: `http://localhost:11434`). Uses `qwen3-embedding:0.6b` (1024-dim) by default.

### `packages/search`

Four search engine implementations that combine the DB queries and embedding pipeline:

| Engine | Implementation | Latency Profile |
| --- | --- | --- |
| **Semantic** | Embed query via Ollama → cosine similarity against all 354k vectors | ~500ms first query (model warmup), ~20ms subsequent (embedding cache) |
| **Full-text** | Direct FTS5 query | <50ms |
| **Regex** | SQL `REGEXP` on description/vendor/product | <200ms |
| **Hybrid** | Runs semantic + FTS in parallel, scores combined as `semantic * 0.7 + fts * 0.3` | ~ Same as semantic |

Includes an in-memory embedding cache (`Map<string, Float32Array>`) that deduplicates identical queries.

### `packages/vector-store`

Low-level vector math operations over Float32Array:

- `cosineSim(a, b)` — Cosine similarity between two vectors
- `arrToVec(arr)` / `bufToVec(buf)` / `vecToBuf(vec)` — Conversion between number arrays, Float32Array, and Node.js Buffer
- `topK(vecs, query, k)` — Find top-K by cosine similarity from an array of `{ id, vec }` objects
- `topKFromBuf(items, query, k, dim)` — Same but reads vectors directly from Buffer (avoids per-row Float32Array allocation)

## Scripts

### `scripts/sync-cves.ts`

Clones or pulls the [cvelistV5](https://github.com/CVEProject/cvelistV5) repository, walks all JSON files under `cves/`, computes SHA256 hashes, and upserts only changed CVEs into the database.

```bash
bun run sync:cves
```

Key behaviors:
- First run: `git clone --depth 1` (downloads the full CVE dataset)
- Subsequent runs: `git pull`, then compares SHA256 hashes against stored values
- Skips unchanged files entirely (fast incremental sync)
- Processes 354k+ CVEs with progress logging every 1000

### `scripts/embed-cves.ts`

Generates and stores embeddings for all CVEs that don't already have them.

```bash
bun run embed:cves
```

Key behaviors:
- Warms up the Ollama model on start
- Processes in batches of 500 (configurable via `BATCH` constant)
- Uses `embedBatch()` for efficient bulk embedding
- Falls back to individual embedding per CVE on batch failure
- Designed to be interrupt-safe: resumes from where it left off
- Has a runtime limit (~9 minutes) for scheduled runs

### `scripts/daily-update.ts`

Cron entry point that chains sync → embed:

```bash
bun run update:daily
```

Suitable for `cron` or CI/CD scheduling (e.g., GitHub Actions):

```yaml
name: Daily CVE Sync
on:
  schedule: [{ cron: '0 6 * * *' }]
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun install
      - run: bun run update:daily
```

### Utility Scripts

| Script | Purpose |
| --- | --- |
| `scripts/inspect.ts` | Quick DB inspection — prints CVE count, embedding count, hash count |
| `scripts/drop-embeddings.ts` | Resets the embeddings table (for full re-embedding) |
| `scripts/fix-cveids.ts` | Repairs CVE ID mismatches between cves and embeddings tables |
| `scripts/speedtest.ts` | Benchmarks search performance across all four modes |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Ollama](https://ollama.com) running locally

### Setup

```bash
git clone https://github.com/forloopcodes/semantic-cve
cd semantic-cve
bun install
cp .env.example .env
```

### Pull the Embedding Model

```bash
ollama pull qwen3-embedding:0.6b
```

### Sync and Index CVEs

```bash
# Sync all CVE records from cvelistV5 into SQLite
bun run sync:cves

# Generate 1024-dim embeddings for every CVE
bun run embed:cves
```

> The sync processes 354k+ CVEs. The embedding step batch-processes them in groups of 500.
> Both scripts are resumable — interrupting and re-running picks up where you left off.

### Start the API Server

```bash
bun run --filter @semantic-cve/api dev
```

The API starts on `http://localhost:4000`. Health check: `curl http://localhost:4000/api/health`.

### Start the Web Frontend

```bash
bun run --filter @semantic-cve/web dev
```

Opens on `http://localhost:3000`.

### Start the MCP Server

```bash
bun run --filter @semantic-cve/mcp dev
```

The MCP server listens on `stdin`/`stdout`. Configure it in any MCP-compatible client (Claude, Cursor, etc.):

```json
{
  "mcpServers": {
    "semantic-cve": {
      "command": "bun",
      "args": ["run", "--filter", "@semantic-cve/mcp", "dev"],
      "cwd": "/path/to/semantic-cve"
    }
  }
}
```

## Search Modes

Search mode determines how queries are matched against the CVE database:

### Semantic

The query is embedded via Ollama's `qwen3-embedding:0.6b` model (1024 dimensions), then compared against all stored CVE vectors using cosine similarity. Results are ranked by similarity score (0 to 1). Best for natural language descriptions.

**Example:** `"Windows privilege escalation using symbolic links"` — finds CVEs related to symlink-based privilege escalation even if the exact words differ.

### Full-text

Uses SQLite FTS5 to match query terms against description, vendor, product, and CWE fields. Results are ranked by FTS5 relevance score. Best for exact keyword or product name lookups.

**Example:** `"CWE-79 XSS"` — returns all CVEs with XSS-related descriptions tagged with CWE-79.

### Regex

Applies SQL `REGEXP` pattern matching against description, vendor, and product fields. Results are unranked (score = 1). Best for power users with exact pattern requirements.

**Example:** `"apache.*2\.4\.[0-9]+"` — finds all CVEs mentioning Apache 2.4.x versions.

### Hybrid

The default mode. Runs semantic and full-text search in parallel, then combines scores using a weighted formula:

```
final_score = semantic_score × 0.7 + fts_score × 0.3
```

This provides the best balance of semantic understanding and keyword precision. Recommended for general use.

## Deployment

| Component | Recommendation | Notes |
| --- | --- | --- |
| Frontend | **Cloudflare Pages** | Static export via Next.js `output: 'export'`. Set `NEXT_PUBLIC_API_URL` to your tunnel or API endpoint |
| API | **Local / VPS** | Requires Ollama + SQLite. 2GB RAM minimum for embedding model |
| MCP Server | **Co-located with API** | Needs access to the same SQLite database and Ollama instance |

### Cloudflare Pages + Tunnel (local API)

The frontend is deployed as a static site to Cloudflare Pages. Since the API runs locally (Ollama + SQLite), a Cloudflare Tunnel exposes it:

```bash
# Build and deploy frontend
cd apps/web
bun run build                    # static export to out/
bunx wrangler pages deploy out --branch production

# Expose local API via tunnel
cloudflared tunnel --url http://localhost:4000
```

Set `NEXT_PUBLIC_API_URL` to the tunnel URL before building. Rebuild and redeploy when the tunnel URL changes.

### Single-VPS Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3-embedding:0.6b

# Clone and run
git clone https://github.com/forloopcodes/semantic-cve
cd semantic-cve
bun install
cp .env.example .env
bun run sync:cves
bun run embed:cves
bun run --filter @semantic-cve/api dev
```

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- | --- |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `API_PORT` | `4000` | Fastify listen port |
| `API_HOST` | `0.0.0.0` | Fastify listen host |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API base URL (set to tunnel URL for production) |

## Tech Stack

| Component | Technology |
| --- | --- |
| Runtime | Node.js via [Bun](https://bun.sh) |
| Monorepo | [Turborepo](https://turbo.build) |
| API Framework | [Fastify](https://fastify.dev) 5 |
| Frontend | [Next.js](https://nextjs.org) 15 (static export) |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com) |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| Database | [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Embedding Model | [Ollama](https://ollama.com) + `qwen3-embedding:0.6b` (1024-dim) |
| Vector Operations | Float32Array, cosine similarity (in-process) |
| Full-Text Search | SQLite FTS5 |
| MCP Protocol | stdio JSON-RPC 2.0 (zero external deps) |
| Language | TypeScript (strict mode) |

## Dataset

The CVE dataset is sourced from the official [cvelistV5](https://github.com/CVEProject/cvelistV5) repository maintained by the CVE Program. The sync script clones this repository (depth 1, ~1.5GB) and parses CVE JSON files following the CVE 5.0 schema. Incremental updates use SHA256 hash comparison to detect changes, so daily syncs are fast after the initial clone.

The project currently indexes **354,000+ CVE records** with 1024-dimensional embeddings stored as BLOBs in SQLite (~1.4GB total for the vector store).
