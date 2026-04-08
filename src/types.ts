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
 *
 * - fast     → Nano Banana (Gemini 2.5 Flash Image) — lightest, fastest
 * - balanced → Nano Banana 2 (Gemini 3.1 Flash Image Preview) — default, 4K capable
 * - quality  → Nano Banana Pro (Gemini 3 Pro Image Preview) — maximum fidelity
 *
 * All three models are accessed via `ai.models.generateContent()` — there's no
 * separate endpoint for image generation, just different model IDs.
 */
export const QUALITY_MODEL_MAP: Record<QualityPreset, string> = {
  fast: "gemini-2.5-flash-image",
  balanced: "gemini-3.1-flash-image-preview",
  quality: "gemini-3-pro-image-preview",
};

/**
 * Maps quality preset to a suggested image size. Higher quality = larger output.
 * Passed to the API via config.imageConfig.imageSize.
 */
export const QUALITY_IMAGE_SIZE_MAP: Record<QualityPreset, string> = {
  fast: "1K",
  balanced: "2K",
  quality: "4K",
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
