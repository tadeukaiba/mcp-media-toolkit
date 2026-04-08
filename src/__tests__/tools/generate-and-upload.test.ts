import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn(async () => ({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: FAKE_PNG_BASE64, mimeType: "image/png" } }],
            },
          },
        ],
      })),
    },
  })),
}));

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation((args) => ({ input: args })),
}));

import { handleGenerateAndUpload } from "../../tools/generate-and-upload.js";
import type { AppConfig } from "../../types.js";

describe("handleGenerateAndUpload", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gen-up-test-"));
    sendMock.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const makeConfig = (withS3 = true): AppConfig => ({
    gemini: { apiKey: "g-key" },
    s3: withS3
      ? {
          endpoint: "https://example.r2.cloudflarestorage.com",
          accessKeyId: "ak",
          secretAccessKey: "sk",
          bucket: "media",
          publicUrl: "https://media.example.com",
          region: "auto",
        }
      : null,
    imageOutputDir: tmpDir,
  });

  it("returns an error when S3 is not configured", async () => {
    const result = await handleGenerateAndUpload({ prompt: "a cat" }, makeConfig(false));
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(
      /S3 storage is not configured/,
    );
  });

  it("generates and uploads successfully, returning the public URL and thumbnail", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await handleGenerateAndUpload(
      { prompt: "a cat", quality: "balanced" },
      makeConfig(),
    );
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Public URL: https://media.example.com/images/");
    expect(result.content[1].type).toBe("image");
  });

  it("reports partial failure when generation succeeds but upload fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("network down"));
    const result = await handleGenerateAndUpload({ prompt: "a cat" }, makeConfig());
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/generated successfully but upload failed/);
    expect(text).toMatch(/Local path \(preserved\):/);
    expect(text).toMatch(/network down/);
  });
});
