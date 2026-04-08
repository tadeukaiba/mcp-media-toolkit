import { GoogleGenAI, Modality } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {
  AspectRatio,
  GeminiConfig,
  ImageFormat,
  QualityPreset,
} from "../types.js";
import { FORMAT_MIME_MAP, QUALITY_MODEL_MAP } from "../types.js";

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
 * Provider wrapping the @google/genai SDK for image generation.
 *
 * Two code paths:
 * - Gemini 2.0 Flash (fast, balanced): generateContent with IMAGE modality.
 *   Aspect ratio is controlled via prompt (appended as hint).
 * - Imagen 3 (quality): generateImages with native aspect_ratio parameter.
 */
export class GeminiProvider {
  private readonly client: GoogleGenAI;

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const model = QUALITY_MODEL_MAP[input.quality];

    let rawImageBase64: string;

    try {
      if (input.quality === "quality") {
        rawImageBase64 = await this.generateWithImagen(model, input);
      } else {
        rawImageBase64 = await this.generateWithFlash(model, input);
      }
    } catch (error) {
      if (error instanceof GeminiGenerationError) throw error;
      throw new GeminiGenerationError(
        `Gemini API error: ${error instanceof Error ? error.message : String(error)}. Check your GEMINI_API_KEY and API quotas at https://aistudio.google.com/`,
        error,
      );
    }

    // Convert/save to the requested format and build a thumbnail.
    const { filePath, thumbnailBase64 } = await this.saveAndThumbnail(
      rawImageBase64,
      input.format,
      input.outputDir,
    );

    return {
      filePath,
      thumbnailBase64,
      thumbnailMimeType: "image/png",
      modelUsed: model,
    };
  }

  private async generateWithFlash(
    model: string,
    input: GenerateImageInput,
  ): Promise<string> {
    // Gemini Flash image generation doesn't have a first-class aspect_ratio
    // param — we pass it as a strong hint in the prompt.
    const promptWithAspect =
      input.aspectRatio === "1:1"
        ? input.prompt
        : `${input.prompt}\n\nAspect ratio: ${input.aspectRatio}`;

    const response = await this.client.models.generateContent({
      model,
      contents: promptWithAspect,
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inlineData = part.inlineData;
      if (inlineData?.data) {
        return inlineData.data;
      }
    }

    throw new GeminiGenerationError(
      `Gemini (${model}) returned no image data. The model may have refused the prompt — try rephrasing or check content policies.`,
    );
  }

  private async generateWithImagen(
    model: string,
    input: GenerateImageInput,
  ): Promise<string> {
    const response = await this.client.models.generateImages({
      model,
      prompt: input.prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: input.aspectRatio,
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      throw new GeminiGenerationError(
        `Imagen (${model}) returned no image data. The model may have refused the prompt — try rephrasing or check content policies.`,
      );
    }
    return imageBytes;
  }

  private async saveAndThumbnail(
    base64Data: string,
    format: ImageFormat,
    outputDir: string,
  ): Promise<{ filePath: string; thumbnailBase64: string }> {
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `gemini-${timestamp}.${format}`;
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
