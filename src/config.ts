import os from "node:os";
import path from "node:path";
import type { AppConfig, S3Config } from "./types.js";

/**
 * Custom error with actionable messages. Users get clear remediation steps.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Loads configuration from environment variables.
 *
 * Fail-fast strategy: every validation error includes the variable name,
 * what's wrong, and where to fix it. Users should be able to resolve any
 * issue without reading source code.
 *
 * Gemini is required. S3 is optional — the server still boots if S3 is
 * not configured, but upload tools will reject calls with a clear message.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // --- Gemini (required) --------------------------------------------------
  const geminiApiKey = env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    throw new ConfigError(
      "GEMINI_API_KEY is required. Get your free key at https://aistudio.google.com/apikey and set it as an environment variable.",
    );
  }

  // --- Image output directory (optional) ---------------------------------
  const imageOutputDir =
    env.IMAGE_OUTPUT_DIR?.trim() || path.join(os.homedir(), "Pictures", "mcp-media");

  // --- S3 (optional, but all-or-nothing) ---------------------------------
  const s3Vars = {
    S3_ENDPOINT: env.S3_ENDPOINT?.trim(),
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID?.trim(),
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY?.trim(),
    S3_BUCKET: env.S3_BUCKET?.trim(),
    S3_PUBLIC_URL: env.S3_PUBLIC_URL?.trim(),
  };

  const s3VarsSet = Object.entries(s3Vars).filter(([, v]) => Boolean(v));
  const s3VarsMissing = Object.entries(s3Vars)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  let s3: S3Config | null = null;

  if (s3VarsSet.length > 0) {
    // Partial config is an error — list exactly which vars are missing.
    if (s3VarsMissing.length > 0) {
      throw new ConfigError(
        `S3 upload requires all of: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_PUBLIC_URL. Missing: ${s3VarsMissing.join(", ")}. Set them all to enable upload, or unset all to disable upload.`,
      );
    }

    // Validate URL fields.
    if (!isValidUrl(s3Vars.S3_ENDPOINT!)) {
      throw new ConfigError(
        `S3_ENDPOINT must be a valid URL (e.g., https://<account-id>.r2.cloudflarestorage.com). Got: "${s3Vars.S3_ENDPOINT}"`,
      );
    }
    if (!isValidUrl(s3Vars.S3_PUBLIC_URL!)) {
      throw new ConfigError(
        `S3_PUBLIC_URL must be a valid URL (e.g., https://media.example.com). Got: "${s3Vars.S3_PUBLIC_URL}"`,
      );
    }

    s3 = {
      endpoint: stripTrailingSlash(s3Vars.S3_ENDPOINT!),
      accessKeyId: s3Vars.S3_ACCESS_KEY_ID!,
      secretAccessKey: s3Vars.S3_SECRET_ACCESS_KEY!,
      bucket: s3Vars.S3_BUCKET!,
      publicUrl: stripTrailingSlash(s3Vars.S3_PUBLIC_URL!),
      region: env.S3_REGION?.trim() || "auto",
    };
  }

  return {
    gemini: { apiKey: geminiApiKey },
    s3,
    imageOutputDir,
  };
}

/**
 * Error thrown at runtime when an upload tool is called but S3 isn't configured.
 * Separate from ConfigError because it fires during tool invocation, not startup.
 */
export class S3NotConfiguredError extends Error {
  constructor() {
    super(
      "S3 storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, and S3_PUBLIC_URL to enable uploads. See .env.example for details.",
    );
    this.name = "S3NotConfiguredError";
  }
}
