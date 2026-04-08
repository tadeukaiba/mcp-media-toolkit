---
name: image-gemini-s3
description: Generate an AI image with Google Gemini and upload it to S3-compatible storage in one step, returning a public URL. Use whenever the user asks for "an image of X", "create an image for my project", "I need a visual of Y", "generate and upload", "make me an image I can use", or any image request where the user is likely to want a URL they can share/embed. This is the most common image workflow — prefer this skill over /generate-image-gemini when the user needs the result online, not just as a local file. Includes automatic prompt optimization.
---

# Generate Image with Gemini and Upload to S3

One-shot workflow: take a user request, optimize the prompt, generate an image with Gemini, upload it to S3-compatible storage, and return the public URL. This is the most common image use case — the user almost always wants a URL they can use.

## When to use this skill vs /generate-image-gemini

- **Use this skill (`image-gemini-s3`)** when the user will want the image online — embedding in docs, sharing a link, using in a project, posting somewhere.
- **Use `/generate-image-gemini`** when the user explicitly only wants a local file, is in a disconnected environment, or hasn't configured S3.

When in doubt, default to this skill. Adding an upload takes almost no extra time and the user ends up with both the local file path AND the URL.

## Workflow

1. **Capture the request.** If the prompt is vague, ask one focused question to lock down the subject. Otherwise proceed.

2. **Optimize the prompt.** Rewrite the user's description into a detailed image prompt. See the Prompt Optimization section below — it's the same approach as `/generate-image-gemini`, and it's the main reason this skill produces better results than calling the raw tool.

3. **Pick defaults.**
   - `quality`: `balanced` unless the user needs photorealistic/maximum fidelity (then `quality`)
   - `aspect_ratio`: match the use case — `1:1` for avatars/icons, `16:9` for landing pages/banners, `9:16` for portraits/stories, `4:3` for photos, `3:4` for posters
   - `format`: `png` default, `webp` if the user mentioned web performance, `jpeg` only for large photographic content

4. **Call the tool.** Use `mcp__mcp-media-toolkit__generate_and_upload_gemini_s3` with the optimized prompt and chosen options. This runs generation and upload in one call, so partial failures are handled cleanly.

5. **Return the result.** Report:
   - The public URL (this is what the user actually needs — make it prominent)
   - The local file path (so they know where the source is saved)
   - The thumbnail preview (shown via the MCP image content block)
   - Which quality preset and aspect ratio were used

6. **Offer iteration.** If they want changes, rerun the tool with a modified prompt. Don't rebuild the whole workflow — just adjust the prompt.

## Prompt Optimization

The raw Gemini tool doesn't optimize prompts — this skill does it on the Claude side, adding detail about composition, lighting, style, and technical quality before the API call.

### Checklist (skip what doesn't apply)

- **Subject** — specific appearance, posture, expression
- **Setting / context** — what's around the subject, foreground vs background
- **Composition** — framing, angle, rule of thirds
- **Lighting** — natural, studio, dramatic, golden hour, etc.
- **Color palette** — warm, muted, vibrant, specific hues
- **Style** — photorealistic, illustration, 3D render, flat vector, editorial
- **Quality** — high detail, sharp focus, cinematic

Keep the result to 1-3 dense sentences. Model responds better to information density than to long paragraphs.

### Before/After Examples

**Example 1**
- User: "I need an image of a sunset for my blog"
- Optimized: "A wide landscape shot of a dramatic sunset over rolling hills, warm golden and orange hues blending into deep violet sky, silhouetted trees on the horizon, soft atmospheric haze, cinematic color grading, photorealistic, high detail, 16:9."
- Call: `quality: balanced`, `aspect_ratio: 16:9`, `format: png`

**Example 2**
- User: "generate a profile picture for a dev tool called 'Pulse'"
- Optimized: "A minimalist modern logo for a developer tool named 'Pulse', a stylized heartbeat waveform forming the letter P, flat vector design, electric blue on white background, clean geometric lines, centered composition, professional tech branding."
- Call: `quality: balanced`, `aspect_ratio: 1:1`, `format: png`

**Example 3 — user was already specific**
- User: "a watercolor illustration of a red fox curled up in autumn leaves, soft morning light"
- Optimized: just tighten wording — "A soft watercolor illustration of a red fox curled up asleep in a pile of autumn leaves, warm morning light filtering through, earthy red and gold palette, painterly brush strokes, cozy and intimate mood."

### When not to over-optimize

If the user's prompt is already dense and specific, don't bloat it. Tighten wording, maybe add technical quality hints, and pass it through. Only expand prompts that are genuinely vague.

## Errors

Partial failure is the most important case here. If the image generates but the upload fails, the tool returns `isError: true` but still includes the local file path and a thumbnail preview. When this happens:

1. Tell the user clearly: "The image was generated but the upload failed."
2. Show the local file path so they don't lose their work.
3. Show the thumbnail so they can see what was made.
4. Explain the upload error and suggest fixing the S3 config, then offer to upload just the local file via `/upload-image-s3`.

Other errors:
- **"Generation failed: Gemini API error"** — bad API key or quota. Point at https://aistudio.google.com/apikey.
- **"returned no image data"** — the model refused the prompt. Rephrase.
- **"S3 storage is not configured"** — user skipped the S3 setup. Point at the README. Offer to fall back to `/generate-image-gemini` (local only).
