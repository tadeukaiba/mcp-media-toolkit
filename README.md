# mcp-media-toolkit

[![npm version](https://img.shields.io/npm/v/mcp-media-toolkit.svg)](https://www.npmjs.com/package/mcp-media-toolkit)
[![downloads](https://img.shields.io/npm/dm/mcp-media-toolkit.svg)](https://www.npmjs.com/package/mcp-media-toolkit)
[![CI](https://github.com/tadeukaiba/mcp-media-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/tadeukaiba/mcp-media-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Generate AI images with Google Gemini (Nano Banana) and upload them to any S3-compatible storage — in a single MCP tool call.**

A batteries-included MCP (Model Context Protocol) server that works in any MCP client (Claude Code, Cursor, Codex, Cline, Continue, Windsurf, …) and doubles as a Claude Code plugin with guided skills and automatic prompt optimization.

## Features

- **Image generation** — full Nano Banana family: `gemini-2.5-flash-image` (fast, 1K), `gemini-3.1-flash-image-preview` (Nano Banana 2, 2K), and `gemini-3-pro-image-preview` (Nano Banana Pro, 4K).
- **S3-compatible upload** — works with Cloudflare R2, AWS S3, MinIO, DigitalOcean Spaces, and any other S3-protocol service.
- **One-shot workflow** — a dedicated `generate_and_upload` tool goes from prompt to public URL in a single call.
- **Automatic prompt optimization** — the Claude Code skills rewrite casual descriptions into rich, detailed prompts so short requests still produce great images.
- **Partial-failure recovery** — if generation succeeds but upload fails, the local file is preserved and reported.
- **Clear error messages** — configuration and runtime errors are designed to be acted on without reading source code.
- **Dual distribution** — use it as an npm package via `npx` in any MCP client, or install it as a Claude Code plugin for the extra skills.

## Quick Start

```bash
# 1. Set environment variables (see Configuration below)
export GEMINI_API_KEY="your-key"
export S3_ENDPOINT="https://..."
export S3_ACCESS_KEY_ID="..."
export S3_SECRET_ACCESS_KEY="..."
export S3_BUCKET="media"
export S3_PUBLIC_URL="https://media.example.com"

# 2. Add to your MCP client config (Claude Code, Cursor, etc.)
#    See Installation section for exact snippets.

# 3. Ask your agent to generate an image — you get back a public URL.
```

## Installation

### As an MCP server (any MCP client)

Add to your MCP client configuration. The server is distributed as an npm package, so `npx` handles installation on the fly.

**Claude Code** — add to `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "mcp-media-toolkit": {
      "command": "npx",
      "args": ["-y", "mcp-media-toolkit"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-key",
        "S3_ENDPOINT": "https://<account>.r2.cloudflarestorage.com",
        "S3_ACCESS_KEY_ID": "your-access-key",
        "S3_SECRET_ACCESS_KEY": "your-secret-key",
        "S3_BUCKET": "media",
        "S3_PUBLIC_URL": "https://media.example.com",
        "S3_REGION": "auto"
      }
    }
  }
}
```

**Cursor** — add to `~/.cursor/mcp.json` with the same shape as above.

**Codex / Cline / Continue / Windsurf** — consult your client's MCP config docs. The command is `npx -y mcp-media-toolkit` with environment variables passed in the `env` block.

### As a Claude Code plugin (with skills)

The Claude Code plugin adds three slash-command skills on top of the MCP tools — the skills optimize prompts automatically and guide the workflow.

```bash
# Via the Claude Code marketplace (once published)
claude plugin add tadeukaiba/mcp-media-toolkit
```

Or clone the repository and point Claude Code at it manually.

### Global npm install

If you prefer a global install over `npx`:

```bash
npm install -g mcp-media-toolkit
```

Then reference `mcp-media-toolkit` directly as the `command` in your MCP config instead of `npx`.

## Configuration

All configuration is done via environment variables. The server validates everything at startup and reports any issue with a clear, actionable message.

### Environment variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key. Get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). | `AIza...` |
| `S3_ENDPOINT` | For upload | Endpoint URL of your S3-compatible storage. | `https://abc123.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | For upload | S3 access key ID. | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | For upload | S3 secret access key. | `abc123...` |
| `S3_BUCKET` | For upload | Bucket name. | `media` |
| `S3_PUBLIC_URL` | For upload | Public base URL where uploads are accessible. **No trailing slash.** | `https://media.example.com` |
| `S3_REGION` | Optional | Region name. Defaults to `auto`. | `auto`, `us-east-1` |
| `IMAGE_OUTPUT_DIR` | Optional | Directory for generated images. Defaults to `~/Pictures/mcp-media/`. | `/tmp/images` |

> All `S3_*` variables are **all-or-nothing**: set them all to enable upload, or leave them all unset to run generation only. A partial configuration is treated as an error so misconfigurations can't silently fail.

### Provider-specific examples

**Cloudflare R2**

```bash
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="<r2-access-key>"
S3_SECRET_ACCESS_KEY="<r2-secret-key>"
S3_BUCKET="media"
S3_PUBLIC_URL="https://media.example.com"   # or https://pub-<hash>.r2.dev
S3_REGION="auto"
```

Enable public access either by turning on the bucket's public access setting or by binding a custom domain to the bucket in the Cloudflare dashboard.

**AWS S3**

```bash
S3_ENDPOINT="https://s3.us-east-1.amazonaws.com"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."
S3_BUCKET="my-bucket"
S3_PUBLIC_URL="https://my-bucket.s3.us-east-1.amazonaws.com"
S3_REGION="us-east-1"
```

Bucket must have public-read ACL or a bucket policy allowing `s3:GetObject` for public access.

**MinIO**

```bash
S3_ENDPOINT="https://minio.example.com"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET="media"
S3_PUBLIC_URL="https://minio.example.com/media"
S3_REGION="us-east-1"
```

**DigitalOcean Spaces**

```bash
S3_ENDPOINT="https://nyc3.digitaloceanspaces.com"
S3_ACCESS_KEY_ID="DO..."
S3_SECRET_ACCESS_KEY="..."
S3_BUCKET="my-space"
S3_PUBLIC_URL="https://my-space.nyc3.digitaloceanspaces.com"
S3_REGION="nyc3"
```

## Tools Reference

### `generate_image_gemini`

Generate an AI image with Gemini and save it to disk.

**Inputs**

| Name | Type | Default | Description |
|---|---|---|---|
| `prompt` | string (required) | — | Description of the image. |
| `quality` | `fast` \| `balanced` \| `quality` | `fast` | `fast` → Nano Banana (1K). `balanced` → Nano Banana 2 (2K). `quality` → Nano Banana Pro (4K, much slower). |
| `aspect_ratio` | `1:1` \| `16:9` \| `9:16` \| `4:3` \| `3:4` | `1:1` | Aspect ratio. |
| `format` | `png` \| `jpeg` \| `webp` | `png` | Output format. |
| `output_dir` | string | `~/Pictures/mcp-media/` | Directory to save the image. |

**Returns** — file path of the saved image plus a 256px thumbnail as an MCP `image` content block.

### `upload_image_s3`

Upload any local image to S3-compatible storage and return the public URL.

**Inputs**

| Name | Type | Default | Description |
|---|---|---|---|
| `file_path` | string (required) | — | Absolute path to the local file. |
| `key` | string | `images/<timestamp>-<filename>` | Destination key in the bucket. |
| `bucket` | string | `S3_BUCKET` env var | Override the configured bucket. |

**Returns** — bucket, key, and public URL.

### `generate_and_upload_gemini_s3`

One-shot generation + upload. Accepts all parameters from the two tools above.

**Returns** — local file path, public URL, and thumbnail. On partial failure (generation succeeded but upload failed) the response preserves the local path and thumbnail so no work is lost.

## Skills Reference (Claude Code)

When installed as a Claude Code plugin, three slash-command skills are available:

- `/generate-image-gemini` — guided image generation with automatic prompt optimization.
- `/upload-image-s3` — upload an existing local image and get a public URL.
- `/image-gemini-s3` — the most common workflow: prompt → optimized prompt → generation → upload → public URL.

The skills rewrite casual prompts into detailed, well-structured image descriptions before calling the underlying tools, so short requests like *"a cat on a book"* still produce high-quality images.

## Prompt Optimization

The skills apply a Subject-Context-Style framework to user prompts before generation:

> **User:** *"a cat on a book"*
>
> **Optimized:** *"A fluffy orange tabby cat curled up on top of an open vintage hardcover book, soft natural window light falling from the left, warm cozy tones, shallow depth of field, photorealistic, high detail."*

The optimization happens on the Claude side (no extra API calls, no extra latency) and covers subject, composition, lighting, color palette, style, and technical quality.

## Troubleshooting

### `GEMINI_API_KEY is required`

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and set it as an environment variable in your MCP client config.

### `S3 storage is not configured`

You're calling an upload tool without any `S3_*` environment variables set. Either configure all of them (see Configuration) or use `generate_image_gemini` alone for local-only generation.

### `S3 upload requires all of: ... Missing: ...`

You set some but not all of the `S3_*` variables. Partial config is rejected — set them all or unset them all.

### `S3_ENDPOINT must be a valid URL`

The value isn't parseable as a URL. Include the protocol (`https://`) and check for typos.

### `S3 upload failed: Access Denied`

Credentials are valid but the API token doesn't have permission to write to this bucket and key. On R2, check the API token's bucket permissions. On AWS S3, verify the IAM policy includes `s3:PutObject`.

### `S3 upload failed: NoSuchBucket`

The bucket doesn't exist at `S3_ENDPOINT`. Create it or fix `S3_BUCKET`.

### Public URL returns 403

Upload succeeded but the bucket isn't publicly readable. The fix depends on the provider:
- **R2**: enable public access on the bucket in the Cloudflare dashboard, or bind a custom domain.
- **S3**: add a bucket policy granting `s3:GetObject` to `Principal: *`, or enable ACLs.
- **MinIO**: set the bucket policy to public read.

### `Gemini returned no image data`

The model refused the prompt (usually content policy). Rephrase or simplify the prompt.

### `File not found`

You passed a relative path or the file was deleted. Always use absolute paths for `file_path`.

## Development

```bash
git clone https://github.com/tadeukaiba/mcp-media-toolkit.git
cd mcp-media-toolkit
npm install
npm run build
npm test
```

Run the server locally:

```bash
node dist/index.js
```

## Contributing

Issues and PRs welcome. Please run `npm test` before opening a PR.

## License

MIT © tadeukaiba
