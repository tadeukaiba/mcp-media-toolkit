import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../config.js";

const validS3 = {
  S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  S3_ACCESS_KEY_ID: "ak",
  S3_SECRET_ACCESS_KEY: "sk",
  S3_BUCKET: "media",
  S3_PUBLIC_URL: "https://media.example.com",
};

describe("loadConfig", () => {
  it("throws when GEMINI_API_KEY is missing", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/GEMINI_API_KEY is required/);
  });

  it("throws when GEMINI_API_KEY is empty string", () => {
    expect(() => loadConfig({ GEMINI_API_KEY: "   " })).toThrow(ConfigError);
  });

  it("loads minimal config with only GEMINI_API_KEY set", () => {
    const cfg = loadConfig({ GEMINI_API_KEY: "g-key" });
    expect(cfg.gemini.apiKey).toBe("g-key");
    expect(cfg.s3).toBeNull();
    expect(cfg.imageOutputDir).toContain("mcp-media");
  });

  it("loads full config when all S3 vars are set", () => {
    const cfg = loadConfig({ GEMINI_API_KEY: "g-key", ...validS3 });
    expect(cfg.s3).not.toBeNull();
    expect(cfg.s3?.bucket).toBe("media");
    expect(cfg.s3?.publicUrl).toBe("https://media.example.com");
    expect(cfg.s3?.region).toBe("auto");
  });

  it("uses custom S3_REGION when provided", () => {
    const cfg = loadConfig({
      GEMINI_API_KEY: "g-key",
      ...validS3,
      S3_REGION: "us-east-1",
    });
    expect(cfg.s3?.region).toBe("us-east-1");
  });

  it("strips trailing slash from S3_PUBLIC_URL and S3_ENDPOINT", () => {
    const cfg = loadConfig({
      GEMINI_API_KEY: "g-key",
      ...validS3,
      S3_PUBLIC_URL: "https://media.example.com/",
      S3_ENDPOINT: "https://example.r2.cloudflarestorage.com/",
    });
    expect(cfg.s3?.publicUrl).toBe("https://media.example.com");
    expect(cfg.s3?.endpoint).toBe("https://example.r2.cloudflarestorage.com");
  });

  it("throws listing missing vars when S3 is partially configured", () => {
    expect(() =>
      loadConfig({
        GEMINI_API_KEY: "g-key",
        S3_ENDPOINT: validS3.S3_ENDPOINT,
        S3_ACCESS_KEY_ID: validS3.S3_ACCESS_KEY_ID,
        // Missing SECRET_ACCESS_KEY, BUCKET, PUBLIC_URL
      }),
    ).toThrow(/Missing: S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_PUBLIC_URL/);
  });

  it("throws when S3_ENDPOINT is not a valid URL", () => {
    expect(() =>
      loadConfig({
        GEMINI_API_KEY: "g-key",
        ...validS3,
        S3_ENDPOINT: "not-a-url",
      }),
    ).toThrow(/S3_ENDPOINT must be a valid URL/);
  });

  it("throws when S3_PUBLIC_URL is not a valid URL", () => {
    expect(() =>
      loadConfig({
        GEMINI_API_KEY: "g-key",
        ...validS3,
        S3_PUBLIC_URL: "also-not-a-url",
      }),
    ).toThrow(/S3_PUBLIC_URL must be a valid URL/);
  });

  it("uses IMAGE_OUTPUT_DIR when provided", () => {
    const cfg = loadConfig({
      GEMINI_API_KEY: "g-key",
      IMAGE_OUTPUT_DIR: "/tmp/custom-output",
    });
    expect(cfg.imageOutputDir).toBe("/tmp/custom-output");
  });

  // Regression: Claude Code may pass a plugin's .mcp.json env block through
  // without interpolating ${VAR} references when the parent shell does not
  // export them. We must treat those literals as unset instead of accepting
  // them as real values.
  describe("unresolved ${VAR} placeholders", () => {
    it("treats IMAGE_OUTPUT_DIR='${IMAGE_OUTPUT_DIR}' as unset (falls back to default)", () => {
      const cfg = loadConfig({
        GEMINI_API_KEY: "g-key",
        IMAGE_OUTPUT_DIR: "${IMAGE_OUTPUT_DIR}",
      });
      expect(cfg.imageOutputDir).toContain("mcp-media");
      expect(cfg.imageOutputDir).not.toContain("${");
    });

    it("treats S3_REGION='${S3_REGION}' as unset (falls back to 'auto')", () => {
      const cfg = loadConfig({
        GEMINI_API_KEY: "g-key",
        ...validS3,
        S3_REGION: "${S3_REGION}",
      });
      expect(cfg.s3?.region).toBe("auto");
    });

    it("treats GEMINI_API_KEY='${GEMINI_API_KEY}' as unset (throws)", () => {
      expect(() => loadConfig({ GEMINI_API_KEY: "${GEMINI_API_KEY}" })).toThrow(
        /GEMINI_API_KEY is required/,
      );
    });

    it("treats ALL S3_* as unset when all are placeholders (no S3 config)", () => {
      const cfg = loadConfig({
        GEMINI_API_KEY: "g-key",
        S3_ENDPOINT: "${S3_ENDPOINT}",
        S3_ACCESS_KEY_ID: "${S3_ACCESS_KEY_ID}",
        S3_SECRET_ACCESS_KEY: "${S3_SECRET_ACCESS_KEY}",
        S3_BUCKET: "${S3_BUCKET}",
        S3_PUBLIC_URL: "${S3_PUBLIC_URL}",
      });
      expect(cfg.s3).toBeNull();
    });
  });
});
