/**
 * Shared types and enums used across the MCP server.
 */

export const QUALITY_PRESETS = ["fast", "balanced", "quality"] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const IMAGE_FORMATS = ["png", "jpeg", "webp"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

/**
 * Mapping from quality preset to the Gemini model used for generation.
 * - fast/balanced: Gemini Flash with image output (Nano Banana 2)
 * - quality: Imagen 3 for maximum fidelity
 */
export const QUALITY_MODEL_MAP: Record<QualityPreset, string> = {
  fast: "gemini-2.0-flash-exp",
  balanced: "gemini-2.0-flash-exp",
  quality: "imagen-3.0-generate-002",
};

/**
 * MIME types for each supported image format.
 */
export const FORMAT_MIME_MAP: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export interface S3Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
  region: string;
}

export interface GeminiConfig {
  apiKey: string;
}

export interface AppConfig {
  gemini: GeminiConfig;
  s3: S3Config | null;
  imageOutputDir: string;
}
