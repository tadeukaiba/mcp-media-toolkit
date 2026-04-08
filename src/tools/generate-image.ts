import { z } from "zod";
import type { AppConfig } from "../types.js";
import { ASPECT_RATIOS, IMAGE_FORMATS, QUALITY_PRESETS } from "../types.js";
import { GeminiProvider } from "../providers/gemini.js";

export const generateImageInputSchema = {
  prompt: z
    .string()
    .min(1, "prompt cannot be empty")
    .describe(
      "The description of the image to generate. Be specific — include subject, composition, lighting, and style for best results.",
    ),
  quality: z
    .enum(QUALITY_PRESETS)
    .default("balanced")
    .describe(
      "Quality preset. 'fast' and 'balanced' use Gemini Flash (Nano Banana). 'quality' uses Imagen 3 for maximum fidelity.",
    ),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .default("1:1")
    .describe(
      "Aspect ratio of the generated image. Square (1:1) is default; use 16:9 for landscape, 9:16 for portrait.",
    ),
  format: z
    .enum(IMAGE_FORMATS)
    .default("png")
    .describe("Output file format. PNG is default (lossless), WebP for smaller size, JPEG for photos."),
  output_dir: z
    .string()
    .optional()
    .describe(
      "Absolute path to the directory where the image will be saved. Defaults to ~/Pictures/mcp-media/.",
    ),
};

export type GenerateImageArgs = {
  prompt: string;
  quality?: "fast" | "balanced" | "quality";
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  format?: "png" | "jpeg" | "webp";
  output_dir?: string;
};

export interface ToolTextContent {
  [key: string]: unknown;
  type: "text";
  text: string;
}
export interface ToolImageContent {
  [key: string]: unknown;
  type: "image";
  data: string;
  mimeType: string;
}
export type ToolContent = ToolTextContent | ToolImageContent;

// The MCP SDK expects result objects to carry an index signature so it can
// attach `_meta` and other passthrough fields. Declaring it here keeps our
// handler return types compatible with `server.registerTool`.
export interface ToolResult {
  [key: string]: unknown;
  content: ToolContent[];
  isError?: boolean;
}

/**
 * Handler for the generate_image_gemini tool.
 *
 * Returns the absolute file path + a 256px thumbnail as an MCP image content
 * block. The full-size image stays on disk; only the thumbnail goes in the
 * MCP response to keep context small.
 */
export async function handleGenerateImage(
  args: GenerateImageArgs,
  config: AppConfig,
): Promise<ToolResult> {
  const quality = args.quality ?? "balanced";
  const aspect_ratio = args.aspect_ratio ?? "1:1";
  const format = args.format ?? "png";
  const outputDir = args.output_dir ?? config.imageOutputDir;

  const provider = new GeminiProvider(config.gemini);

  try {
    const result = await provider.generate({
      prompt: args.prompt,
      quality,
      aspectRatio: aspect_ratio,
      format,
      outputDir,
    });

    return {
      content: [
        {
          type: "text",
          text: `Image generated with ${result.modelUsed} (${quality}, ${aspect_ratio}, ${format}).\nSaved to: ${result.filePath}`,
        },
        {
          type: "image",
          data: result.thumbnailBase64,
          mimeType: result.thumbnailMimeType,
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}
