<div align="center">

# Semantic CVE

### Describe a vulnerability in plain English. Find every relevant CVE.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-000?style=flat-square&logo=bun&logoColor=fff)](https://bun.sh)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=fff)](https://turbo.build)
[![Fastify](https://img.shields.io/badge/Fastify-000?style=flat-square&logo=fastify&logoColor=fff)](https://fastify.dev)
[![Next.js](https://img.shields.io/badge/Next.js-000?style=flat-square&logo=next.js&logoColor=fff)](https://nextjs.org)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=fff)](https://sqlite.org)
[![Ollama](https://img.shields.io/badge/Ollama-000?style=flat-square&logo=ollama&logoColor=fff)](https://ollama.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

⭐ If you like this project, star it on GitHub — it helps a lot!

[Quickstart](#quickstart) • [Features](#features) • [Search](#search-modes) • [Architecture](#architecture) • [Deployment](#deployment) • [MCP](#mcp-server)

</div>

Semantic CVE turns natural language into CVE discovery. Instead of guessing keywords, describe the vulnerability — _"Windows privilege escalation via symbolic links"_ — and it finds every semantically relevant CVE across **354,000+ records** using local Ollama embeddings, full-text, and regex search.

The project ships as three deployable apps — a **Fastify API**, a **Next.js frontend**, and a **zero-dependency MCP server** — orchestrated as a Turborepo monorepo.

> [!TIP]
> Zero cloud dependencies. Runs entirely on your machine with Ollama + SQLite. No API keys, no vector databases, no GPU required.

## Quickstart

```bash
git clone https://github.com/forloopcodes/semantic-cve
cd semantic-cve
bun install
cp .env.example .env
ollama pull qwen3-embedding:0.6b

# Sync & index 354k+ CVEs (resumable — Ctrl+C safe)
bun run sync:cves
bun run embed:cves

# Start everything
bun run --filter @semantic-cve/api dev    # API on :4000
bun run --filter @semantic-cve/web dev    # Frontend on :3000
```

> [!NOTE]
> The sync processes the entire CVE dataset (~1.5GB clone) and takes a few minutes. The embedding step batch-processes in groups of 500 and is fully resumable.

## Features

- **Natural language search** — Describe a vulnerability and get results ranked by semantic similarity, not keyword overlap
- **4 search modes** — Semantic (cosine similarity), Full-text (FTS5), Regex (REGEXP), Hybrid (weighted combination)
- **Similar CVEs** — For any CVE, find semantically related ones via vector proximity
- **MCP server** — Expose all search capabilities as tools for Claude, Cursor, and any MCP-compatible AI agent
- **Daily incremental sync** — SHA256 change tracking; only re-embeds what changed
- **Synthetic document embeddings** — Combines description, vendor, product, CWE, severity, and affected versions into one embedding document for dramatically better matches
- **Zero-dependency MCP** — The MCP protocol is implemented from scratch in ~160 lines of TypeScript. No SDKs, no wrappers.

## Search Modes

| Mode | How it works | Latency | Best for |
|---|---|---|---|
| **Semantic** | Ollama `qwen3-embedding:0.6b` → 1024-dim query vector → cosine similarity vs all 354k vectors | ~500ms first query, ~20ms cached | Natural language descriptions |
| **Full-text** | SQLite FTS5 on description, vendor, product, CWE | <50ms | Exact keywords, product names |
| **Regex** | SQL `REGEXP` on description, vendor, product | <200ms | Power users with exact patterns |
| **Hybrid** | Semantic (×0.7) + Full-text (×0.3) in parallel | ~ Same as semantic | General use (default) |

## Architecture

```
             ┌──────────────────────────────────────────┐
             │              User Query                   │
             └────────────┬─────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────────┐
   │ Semantic │   │ Full-text│   │    Regex     │
   │ (Ollama  │   │ (FTS5)   │   │   (REGEXP)   │
   │  cosine) │   │          │   │              │
   └────┬─────┘   └────┬─────┘   └──────┬───────┘
        │              │                │
        └──────────────┴────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    SQLite DB     │
              │ 354k CVEs │ FTS │
              │ Vec Store │ SHA │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
      ┌──────────────┐  ┌──────────────┐
      │  Fastify API  │  │  MCP Server  │
      │   (port 4000) │  │   (stdio)    │
      └──────┬───────┘  └──────┬───────┘
             │                 │
             ▼                 ▼
     ┌──────────────┐  ┌──────────────┐
     │  Next.js 15   │  │  AI Agents   │
     │  (port 3000)  │  │ (Claude etc) │
     └──────────────┘  └──────────────┘
```

## Apps

### `apps/web` — Next.js 15 Frontend

Dark-themed, shadcn/ui components, Tailwind CSS v4, Geist fonts.

| Route | Description |
|---|---|
| `/` | Hero search with example query chips |
| `/search?q=&mode=` | Results with CVE cards, score bars, pagination, mode selector |
| `/cve?id=` | Detail with metadata, CVSS, similar CVEs, raw JSON |

```bash
bun run --filter @semantic-cve/web dev     # localhost:3000
bun run --filter @semantic-cve/web build   # static export → out/
```

### `apps/api` — Fastify 5 API

| Route | Description |
|---|---|
| `GET /api/search` | Search across all modes with filters (cvss, cwe, vendor, product) |
| `GET /api/cves/:id` | Single CVE detail |
| `GET /api/cves/:id/similar` | Semantically similar CVEs |
| `GET /api/cves` | Latest CVEs by recency |

```bash
bun run --filter @semantic-cve/api dev    # localhost:4000
```

### `apps/mcp` — MCP Server (zero external deps)

Exposes 6 tools for AI agents via stdio JSON-RPC 2.0. Framework-free — the protocol is implemented in plain TypeScript.

| Tool | Returns |
|---|---|
| `search_cves` | Ranked results across all modes |
| `get_cve` | Full CVE detail |
| `related_cves` | Semantically similar CVEs |
| `search_by_product` | CVEs matching vendor/product |
| `search_by_cwe` | CVEs by CWE ID |
| `latest_cves` | Recent CVEs |

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

## Packages

| Package | Purpose |
|---|---|
| `packages/shared` | Types, constants (`EMBEDDING_DIMENSION`, `HYBRID_WEIGHTS`) |
| `packages/db` | SQLite schema + queries via `better-sqlite3` (cves, fts, embeddings, hashes) |
| `packages/cve-parser` | cvelistV5 JSON parser + synthetic document builder |
| `packages/embeddings` | Ollama embedding client (single + batch) |
| `packages/search` | 4 search engine implementations (semantic, fts, regex, hybrid) |
| `packages/vector-store` | Float32Array ops — cosine similarity, topK, buffer conversions |

## Scripts

| Script | Purpose |
|---|---|
| `bun run sync:cves` | Clone/pull cvelistV5, SHA256 tracking, upsert changed CVEs |
| `bun run embed:cves` | Batch-embed all CVEs without embeddings (interrupt-safe) |
| `bun run update:daily` | Sync → Embed (cron-ready, CI/CD friendly) |
| `bun run inspect` | DB stats: CVE count, embedding count, hash count |
| `bun run speedtest` | Benchmark all 4 search modes |
| `bun run drop:embeddings` | Reset vector store for full re-embed |

```yaml
# GitHub Actions — daily sync
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

## Deployment

| Component | Stack | Notes |
|---|---|---|
| Frontend | Cloudflare Pages / Vercel | Static export. Set `NEXT_PUBLIC_API_URL` |
| API | VPS ($5-10/mo) | Requires Ollama + SQLite. 2GB RAM min |
| MCP | Co-located with API | Same DB + Ollama instance |

### Single-VPS Setup

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3-embedding:0.6b

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
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `API_PORT` | `4000` | Fastify listen port |
| `API_HOST` | `0.0.0.0` | Fastify listen host |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API URL for the frontend |

## Tech Stack

| | |
|---|---|
| **Runtime** | Node.js via **Bun** |
| **Monorepo** | **Turborepo** |
| **API** | **Fastify 5** |
| **Frontend** | **Next.js 15** (App Router), **Tailwind v4**, shadcn/ui, Geist |
| **Database** | **SQLite** via `better-sqlite3` |
| **Embeddings** | **Ollama** + `qwen3-embedding:0.6b` (1024-dim) |
| **Vector Search** | Float32Array cosine similarity (in-process) |
| **Full-text** | SQLite FTS5 |
| **MCP Protocol** | stdio JSON-RPC 2.0 (zero deps) |
| **Language** | TypeScript (strict mode) |

## Dataset

Sourced from the official [cvelistV5](https://github.com/CVEProject/cvelistV5) repository. The sync script clones (depth 1, ~1.5GB) and parses CVE JSON 5.0 schema files. Incremental updates use SHA256 hash comparison — daily syncs are fast after the initial clone.

**354,000+ CVE records** indexed with 1024-dimensional embeddings stored as SQLite BLOBs (~1.4GB for the vector store).
