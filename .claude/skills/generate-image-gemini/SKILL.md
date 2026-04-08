---
name: generate-image-gemini
description: Generate AI images using Google Gemini (Nano Banana) or Imagen 3. Use whenever the user asks to "generate an image", "create a picture", "make artwork", "draw something", "I need an image of X", "create a visual", or any request involving AI image generation. Optimizes the user's prompt automatically before calling the generation tool so output quality is high even from short casual descriptions. Does NOT upload — use /image-gemini-s3 if the user also needs a public URL.
---

# Generate Image with Gemini

Generate an AI image using the `generate_image_gemini` MCP tool. Before calling the tool, rewrite the user's prompt into a detailed, well-structured image description so the model produces a high-quality result.

## Workflow

1. **Understand what the user wants.** If the request is vague ("make me an image"), ask one focused question to capture the subject. Otherwise proceed.

2. **Optimize the prompt.** Rewrite the user's description into a detailed image prompt following the structure below. Do this silently — don't show the user a wall of technical prompt engineering unless they ask.

3. **Choose sensible defaults.** Unless the user specified otherwise:
   - `quality`: `balanced` (good tradeoff of speed and fidelity)
   - `aspect_ratio`: `1:1` for icons/avatars/logos, `16:9` for landscapes/banners, `9:16` for portraits/phone wallpapers, `4:3` for photos
   - `format`: `png` (lossless, safest default)

4. **Call the tool.** Use `mcp__mcp-media-toolkit__generate_image_gemini` with the optimized prompt. Use `quality: "quality"` only when the user explicitly asks for maximum fidelity or for photorealistic work — it's slower and uses Imagen 3.

5. **Show the result.** The tool returns a thumbnail preview and the local file path. Report both to the user, plus confirm what aspect ratio and quality preset were used.

6. **Offer upload.** After generation, ask if they want a public URL. If yes, call `mcp__mcp-media-toolkit__upload_image_s3` with the returned file path. Skip this step if the user already said they only want the local file.

## Prompt Optimization

Short casual prompts produce generic output. A good image prompt describes **subject**, **context**, and **style** with enough specificity that two people reading it would imagine roughly the same image.

### Checklist

Before sending a prompt to the model, make sure it covers these dimensions (skip any that don't apply — e.g. a logo doesn't need lighting):

- **Subject**: What is the main thing? Be specific about appearance, age, posture, expression.
- **Context / setting**: Where is it? What's around it? Foreground vs background.
- **Composition / framing**: Close-up, wide shot, overhead, eye-level, rule of thirds.
- **Lighting**: Natural, studio, dramatic, golden hour, soft, backlit, neon.
- **Color palette**: Warm tones, muted, vibrant, monochrome, specific hues.
- **Style**: Photorealistic, illustration, watercolor, cinematic, 3D render, minimalist flat design.
- **Technical quality**: High detail, sharp focus, 4k, depth of field.

Keep the final prompt to 1-3 dense sentences. Don't write paragraphs — the model responds better to information-dense phrasing than to long narratives.

### Examples

**Example 1 — vague request**
- User says: "a cat on a book"
- Optimized: "A fluffy orange tabby cat curled up on top of an open vintage hardcover book, soft natural window light falling from the left, warm cozy tones, shallow depth of field, photorealistic, high detail."

**Example 2 — product shot**
- User says: "an image for my coffee app's landing page"
- Optimized (after asking what kind of vibe): "A minimalist overhead shot of a single white ceramic cup filled with latte art on a clean marble countertop, soft diffused morning light, muted warm color palette, lots of negative space on the right for text, cinematic, editorial photography style."

**Example 3 — abstract / logo**
- User says: "generate a logo concept for a dev tool called 'Pulse'"
- Optimized: "A minimalist modern logo for a developer tool named 'Pulse', a stylized heartbeat waveform forming the letter P, flat vector design, electric blue on white background, clean geometric lines, technology branding."

### When NOT to over-optimize

If the user gives a very specific prompt already ("photorealistic portrait of a 40-year-old blacksmith with a leather apron, forge in the background, Rembrandt lighting"), don't add fluff — they know what they want. Your job in that case is just to pass it through and maybe tighten the wording. Only expand prompts that are genuinely underspecified.

## Quality Presets

- **fast** — Gemini 2.0 Flash, quickest iteration. Use for drafts, sketches, exploratory ideas.
- **balanced** — Gemini 2.0 Flash with a higher-quality prompt. Default for most work.
- **quality** — Imagen 3. Use when the user needs photorealistic output, print-quality assets, or explicitly asks for maximum fidelity. Slower and potentially hits stricter content filters.

## Errors

If the tool returns an error:
- **"Gemini API error"** — likely a bad or missing `GEMINI_API_KEY`, or quota exhaustion. Tell the user to check https://aistudio.google.com/apikey.
- **"returned no image data"** — the model refused the prompt. Rephrase to avoid ambiguity or content policy edges.
- **"File not found"** — the output directory isn't writable. Suggest passing `output_dir` with an absolute path the user controls.
