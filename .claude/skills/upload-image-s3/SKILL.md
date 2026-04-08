---
name: upload-image-s3
description: Upload a local image file to S3-compatible storage (Cloudflare R2, AWS S3, MinIO, DigitalOcean Spaces) and return the public URL. Use whenever the user asks to "upload this image", "host this file", "get a public URL for X", "put this image online", "upload to R2", "upload to S3", or wants to make a local image accessible via URL. Works with any image file already on disk — use /generate-image-gemini first if the image needs to be generated.
---

# Upload Image to S3-Compatible Storage

Upload a local image file to the configured S3-compatible storage using the `upload_image_s3` MCP tool and return the public URL.

## Workflow

1. **Get the file path.**
   - If the user provided an absolute path, use it directly.
   - If they provided a relative path or just a filename, ask for the absolute path or resolve it based on the current context (e.g. recently generated files, files in the current working directory).
   - If they referenced "the last image" or "the one we just generated", use the file path from the most recent `generate_image_gemini` result in this conversation.

2. **Verify the file exists.** Before calling the tool, use a quick `Bash` call (`test -f <path>`) if there's any doubt — it's cheaper to fail fast with a clear message than to wait for the MCP error.

3. **Decide on a key (optional).**
   - Default: the tool auto-generates `images/<timestamp>-<filename>`. Use this unless the user has a reason to override.
   - If the user wants a specific path in the bucket (e.g. `avatars/user-123.png`), pass it as `key`.
   - Keys with slashes work fine — they become folder-like prefixes in the bucket.

4. **Call the tool.** Use `mcp__mcp-media-toolkit__upload_image_s3` with `file_path` (and `key` if overriding).

5. **Report the URL.** The tool returns the bucket, key, and public URL. Show the user the public URL prominently — that's what they actually need. Mention the bucket/key only if relevant.

## Errors

- **"S3 storage is not configured"** — the user needs to set `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, and `S3_PUBLIC_URL` in their environment. Point them at the project README's Configuration section.
- **"File not found"** — the path is wrong or the file was deleted. Ask the user to confirm the path.
- **"S3 upload failed: Access Denied"** — the credentials are wrong or the bucket doesn't allow uploads with that key. Tell the user to verify their API token permissions include `PutObject` on the target bucket.
- **"S3 upload failed: NoSuchBucket"** — the bucket doesn't exist. Tell the user to create it or fix `S3_BUCKET`.

## Tips

- The public URL format is `S3_PUBLIC_URL + "/" + key`. If the returned URL doesn't open in the browser, the issue is usually that the bucket isn't publicly readable or the `S3_PUBLIC_URL` is wrong — not the upload itself.
- For R2: public access requires enabling "public bucket" in the Cloudflare dashboard OR setting up a custom domain bound to the bucket. Mention this if the user reports the URL returns a 403.
