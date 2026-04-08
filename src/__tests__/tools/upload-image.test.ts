import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn().mockImplementation((args) => ({ input: args })),
}));

import { handleUploadImage } from "../../tools/upload-image.js";
import type { AppConfig } from "../../types.js";

const s3Config: AppConfig["s3"] = {
  endpoint: "https://example.r2.cloudflarestorage.com",
  accessKeyId: "ak",
  secretAccessKey: "sk",
  bucket: "media",
  publicUrl: "https://media.example.com",
  region: "auto",
};

const baseConfig: AppConfig = {
  gemini: { apiKey: "g-key" },
  s3: s3Config,
  imageOutputDir: "/tmp",
};

describe("handleUploadImage", () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "upload-tool-test-"));
    tmpFile = path.join(tmpDir, "image.png");
    await fs.writeFile(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns an error when S3 is not configured", async () => {
    const result = await handleUploadImage(
      { file_path: tmpFile },
      { ...baseConfig, s3: null },
    );
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(
      /S3 storage is not configured/,
    );
  });

  it("uploads with a default key when none is provided", async () => {
    const result = await handleUploadImage({ file_path: tmpFile }, baseConfig);
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/Public URL: https:\/\/media\.example\.com\/images\/\d+-image\.png/);
  });

  it("uploads with the provided key", async () => {
    const result = await handleUploadImage(
      { file_path: tmpFile, key: "custom/path.png" },
      baseConfig,
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("https://media.example.com/custom/path.png");
  });

  it("returns an error when the file does not exist", async () => {
    const result = await handleUploadImage(
      { file_path: "/does/not/exist.png" },
      baseConfig,
    );
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/File not found/);
  });
});
