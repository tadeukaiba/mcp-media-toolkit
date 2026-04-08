import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import type { S3Config } from "../types.js";

export interface UploadInput {
  /** Absolute path to a local file that will be uploaded. */
  filePath: string;
  /** Destination key in the bucket. Can include a prefix like "images/". */
  key: string;
  /** Optional override for the bucket configured in env vars. */
  bucket?: string;
}

export interface UploadResult {
  publicUrl: string;
  bucket: string;
  key: string;
}

/**
 * Thrown when upload fails. Message is meant to be shown to the end user.
 */
export class S3UploadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "S3UploadError";
  }
}

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MIME_MAP[ext] ?? "application/octet-stream";
}

/**
 * Provider wrapping @aws-sdk/client-s3 for uploads to any S3-compatible storage.
 *
 * Works with: Cloudflare R2, AWS S3, MinIO, DigitalOcean Spaces, and any other
 * service that implements the S3 protocol. The only difference is the endpoint
 * and region, both configured via environment variables.
 */
export class S3Provider {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // forcePathStyle is required for MinIO and some self-hosted S3 setups.
      // R2 and AWS S3 handle both styles, so this is a safe default.
      forcePathStyle: true,
    });
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const bucket = input.bucket ?? this.config.bucket;

    // Validate file exists and is readable before attempting upload.
    try {
      await fs.access(input.filePath);
    } catch {
      throw new S3UploadError(
        `File not found: ${input.filePath}. Provide an absolute path to an existing file.`,
      );
    }

    const fileStat = await fs.stat(input.filePath);
    if (!fileStat.isFile()) {
      throw new S3UploadError(
        `Path is not a file: ${input.filePath}. Provide an absolute path to an existing file.`,
      );
    }

    const body = await fs.readFile(input.filePath);
    const contentType = guessContentType(input.filePath);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new S3UploadError(
        `S3 upload failed: ${message}. Check your S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and bucket permissions.`,
        error,
      );
    }

    return {
      publicUrl: `${this.config.publicUrl}/${input.key}`,
      bucket,
      key: input.key,
    };
  }
}

/**
 * Builds a default key for uploaded files: "images/<timestamp>-<basename>".
 * Used when the caller doesn't provide an explicit key.
 */
export function buildDefaultKey(filePath: string, prefix = "images"): string {
  const basename = path.basename(filePath);
  const timestamp = Date.now();
  return `${prefix}/${timestamp}-${basename}`;
}
