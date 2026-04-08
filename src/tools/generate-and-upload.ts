import { z } from "zod";
import path from "node:path";
import { S3NotConfiguredError } from "../config.js";
import { GeminiProvider } from "../providers/gemini.js";
import { S3Provider, buildDefaultKey } from "../providers/s3.js";
import type { AppConfig } from "../types.js";
import { ASPECT_RATIOS, IMAGE_FORMATS, QUALITY_PRESETS } from "../types.js";
import type { ToolResult } from "./generate-image.js";

export const generateAndUploadInputSchema = {
  prompt: z
    .string()
    .min(1, "prompt cannot be empty")
    .describe("The description of the image to generate."),
  quality: z
    .enum(QUALITY_PRESETS)
    .default("fast")
    .describe(
      "Quality preset. Default is 'fast' (Nano Banana, 1K) which is cheap and quick. Use 'balanced' (Nano Banana 2, 2K) when quality matters more than speed, and 'quality' (Nano Banana Pro, 4K) for maximum fidelity — much slower.",
    ),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .default("1:1")
    .describe("Aspect ratio of the generated image."),
  format: z
    .enum(IMAGE_FORMATS)
    .default("png")
    .describe("Output file format (png, jpeg, webp)."),
  output_dir: z
    .string()
    .optional()
    .describe("Absolute path for temporary local save. Defaults to ~/Pictures/mcp-media/."),
  key: z
    .string()
    .optional()
    .describe("Destination key in the S3 bucket. Defaults to 'images/<timestamp>-<filename>'."),
  bucket: z
    .string()
    .optional()
    .describe("Override the bucket configured in S3_BUCKET env var."),
};

export type GenerateAndUploadArgs = {
  prompt: string;
  quality?: "fast" | "balanced" | "quality";
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  format?: "png" | "jpeg" | "webp";
  output_dir?: string;
  key?: string;
  bucket?: string;
};

/**
 * Handler for the generate_and_upload_gemini_s3 tool.
 *
 * The most common workflow: generate an image with Gemini, upload to S3, and
 * return the public URL + a thumbnail preview. On partial failure (generation
 * succeeded but upload failed), the local file path is still reported so the
 * user doesn't lose work.
 */
export async function handleGenerateAndUpload(
  args: GenerateAndUploadArgs,
  config: AppConfig,
): Promise<ToolResult> {
  if (!config.s3) {
    return {
      isError: true,
      content: [{ type: "text", text: new S3NotConfiguredError().message }],
    };
  }

  const quality = args.quality ?? "fast";
  const aspect_ratio = args.aspect_ratio ?? "1:1";
  const format = args.format ?? "png";
  const outputDir = args.output_dir ?? config.imageOutputDir;

  // Step 1: generate the image.
  const geminiProvider = new GeminiProvider(config.gemini);
  let generationResult;
  try {
    generationResult = await geminiProvider.generate({
      prompt: args.prompt,
      quality,
      aspectRatio: aspect_ratio,
      format,
      outputDir,
    });
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  // Step 2: upload the generated file.
  const s3Provider = new S3Provider(config.s3);
  const key =
    args.key ?? buildDefaultKey(path.basename(generationResult.filePath));

  try {
    const uploadResult = await s3Provider.upload({
      filePath: generationResult.filePath,
      key,
      bucket: args.bucket,
    });

    return {
      content: [
        {
          type: "text",
          text: `Image generated and uploaded.\nModel: ${generationResult.modelUsed}\nLocal path: ${generationResult.filePath}\nPublic URL: ${uploadResult.publicUrl}`,
        },
        {
          type: "image",
          data: generationResult.thumbnailBase64,
          mimeType: generationResult.thumbnailMimeType,
        },
      ],
    };
  } catch (error) {
    // Partial failure: image was generated but upload failed. Tell the user
    // where the file is so they don't lose it.
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Image generated successfully but upload failed.\nLocal path (preserved): ${generationResult.filePath}\nError: ${error instanceof Error ? error.message : String(error)}`,
        },
        {
          type: "image",
          data: generationResult.thumbnailBase64,
          mimeType: generationResult.thumbnailMimeType,
        },
      ],
    };
  }
}
