import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {
  AspectRatio,
  GeminiConfig,
  ImageFormat,
  QualityPreset,
} from "../types.js";
import {
  FORMAT_MIME_MAP,
  QUALITY_IMAGE_SIZE_MAP,
  QUALITY_MODEL_MAP,
} from "../types.js";

export interface GenerateImageInput {
  prompt: string;
  quality: QualityPreset;
  aspectRatio: AspectRatio;
  format: ImageFormat;
  outputDir: string;
}

export interface GenerateImageResult {
  /** Absolute path of the saved image file. */
  filePath: string;
  /** Small base64 thumbnail (256px) for MCP preview. Never includes the full image. */
  thumbnailBase64: string;
  /** MIME type of the thumbnail (always image/png for consistency). */
  thumbnailMimeType: "image/png";
  /** The model that actually generated the image. */
  modelUsed: string;
}

/**
 * Thrown when Gemini returns no image in the response, or when the API call
 * fails. The message is meant to be shown to the end user.
 */
export class GeminiGenerationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GeminiGenerationError";
  }
}

/**
 * Builds a filesystem-safe slug from the first meaningful words of a prompt.
 *
 * The goal is to make generated files recognizable at a glance without
 * opening them — "gemini-1775659536817-minimalist-modern-logo.png" is much
 * more useful than "gemini-1775659536817.png" when scrolling a folder.
 *
 * Keeps the slug short (max 40 chars) so we don't bump into filesystem
 * path limits, drops common English filler at the start so the slug leads
 * with the actual subject, and returns an empty string for prompts that
 * have no alphanumeric content (caller falls back to timestamp-only name).
 */
export function slugifyPrompt(prompt: string): string {
  const FILLER = new Set([
    "a", "an", "the", "of", "with", "and", "or", "on", "in", "at", "to",
    "for", "by", "from", "is", "are", "this", "that", "it",
  ]);

  // Normalize: lowercase, split on any non-alphanumeric run.
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  // Strip leading filler words so the slug starts with something meaningful.
  let start = 0;
  while (start < words.length && FILLER.has(words[start])) start++;

  const meaningful = words.slice(start, start + 6);
  const slug = meaningful.join("-");

  // Hard cap on length so we never blow past filesystem limits.
  return slug.slice(0, 40).replace(/-+$/, "");
}

/**
 * Provider wrapping the @google/genai SDK for image generation via the
 * Nano Banana family of Gemini models.
 *
 * All three quality presets use `ai.models.generateContent()` with a different
 * model ID — the API is unified. Aspect ratio and image size are passed
 * natively via `config.imageConfig`, which all Nano Banana models support.
 */
export class GeminiProvider {
  private readonly client: GoogleGenAI;

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const model = QUALITY_MODEL_MAP[input.quality];
    const imageSize = QUALITY_IMAGE_SIZE_MAP[input.quality];

    let rawImageBase64: string;
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: input.prompt,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: input.aspectRatio,
            imageSize,
          },
        },
      });

      rawImageBase64 = this.extractImageFromResponse(response, model);
    } catch (error) {
      if (error instanceof GeminiGenerationError) throw error;
      throw new GeminiGenerationError(
        `Gemini API error: ${error instanceof Error ? error.message : String(error)}. Check your GEMINI_API_KEY and API quotas at https://aistudio.google.com/`,
        error,
      );
    }

    const { filePath, thumbnailBase64 } = await this.saveAndThumbnail(
      rawImageBase64,
      input.format,
      input.outputDir,
      slugifyPrompt(input.prompt),
    );

    return {
      filePath,
      thumbnailBase64,
      thumbnailMimeType: "image/png",
      modelUsed: model,
    };
  }

  private extractImageFromResponse(response: unknown, model: string): string {
    // The SDK returns a response with candidates[].content.parts[].inlineData.
    // We walk the first candidate's parts and grab the first inline image.
    const candidates = (response as { candidates?: unknown[] }).candidates;
    const parts =
      (candidates?.[0] as { content?: { parts?: unknown[] } })?.content?.parts ??
      [];

    for (const part of parts) {
      const inlineData = (part as { inlineData?: { data?: string } })
        .inlineData;
      if (inlineData?.data) {
        return inlineData.data;
      }
    }

    throw new GeminiGenerationError(
      `Gemini (${model}) returned no image data. The model may have refused the prompt — try rephrasing or check content policies.`,
    );
  }

  private async saveAndThumbnail(
    base64Data: string,
    format: ImageFormat,
    outputDir: string,
    slug: string,
  ): Promise<{ filePath: string; thumbnailBase64: string }> {
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = Date.now();
    const filename = slug
      ? `gemini-${timestamp}-${slug}.${format}`
      : `gemini-${timestamp}.${format}`;
    const filePath = path.join(outputDir, filename);

    const rawBuffer = Buffer.from(base64Data, "base64");

    // Convert to the requested format (Gemini usually returns PNG).
    const pipeline = sharp(rawBuffer);
    let finalBuffer: Buffer;
    if (format === "png") finalBuffer = await pipeline.png().toBuffer();
    else if (format === "jpeg") finalBuffer = await pipeline.jpeg().toBuffer();
    else finalBuffer = await pipeline.webp().toBuffer();

    await fs.writeFile(filePath, finalBuffer);

    // Build a ~256px thumbnail for MCP preview. Keep context small.
    const thumbnailBuffer = await sharp(rawBuffer)
      .resize(256, 256, { fit: "inside" })
      .png()
      .toBuffer();

    return {
      filePath,
      thumbnailBase64: thumbnailBuffer.toString("base64"),
    };
  }
}

// Keep reference to FORMAT_MIME_MAP so it's not tree-shaken if downstream needs it.
export { FORMAT_MIME_MAP };
