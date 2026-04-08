import { z } from "zod";
import { S3NotConfiguredError } from "../config.js";
import { S3Provider, buildDefaultKey } from "../providers/s3.js";
import type { AppConfig } from "../types.js";
import type { ToolResult } from "./generate-image.js";

export const uploadImageInputSchema = {
  file_path: z
    .string()
    .min(1, "file_path cannot be empty")
    .describe(
      "Absolute path to the local image file to upload. Must exist and be readable.",
    ),
  key: z
    .string()
    .optional()
    .describe(
      "Destination key (path) in the S3 bucket. Defaults to 'images/<timestamp>-<filename>'.",
    ),
  bucket: z
    .string()
    .optional()
    .describe("Override the bucket configured in S3_BUCKET env var."),
};

export type UploadImageArgs = {
  file_path: string;
  key?: string;
  bucket?: string;
};

/**
 * Handler for the upload_image_s3 tool.
 *
 * Uploads a local file to S3-compatible storage and returns the public URL.
 * S3 must be configured via env vars — otherwise returns a clear error.
 */
export async function handleUploadImage(
  args: UploadImageArgs,
  config: AppConfig,
): Promise<ToolResult> {
  if (!config.s3) {
    return {
      isError: true,
      content: [{ type: "text", text: new S3NotConfiguredError().message }],
    };
  }

  const provider = new S3Provider(config.s3);
  const key = args.key ?? buildDefaultKey(args.file_path);

  try {
    const result = await provider.upload({
      filePath: args.file_path,
      key,
      bucket: args.bucket,
    });

    return {
      content: [
        {
          type: "text",
          text: `Uploaded successfully.\nBucket: ${result.bucket}\nKey: ${result.key}\nPublic URL: ${result.publicUrl}`,
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
