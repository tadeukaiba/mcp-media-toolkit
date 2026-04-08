import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3Provider, S3UploadError, buildDefaultKey } from "../../providers/s3.js";
import type { S3Config } from "../../types.js";

// Mock the AWS SDK client so tests don't hit the network.
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({}),
    })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ input: args })),
  };
});

const validConfig: S3Config = {
  endpoint: "https://example.r2.cloudflarestorage.com",
  accessKeyId: "ak",
  secretAccessKey: "sk",
  bucket: "media",
  publicUrl: "https://media.example.com",
  region: "auto",
};

describe("buildDefaultKey", () => {
  it("builds a key with images/ prefix by default", () => {
    const key = buildDefaultKey("/tmp/foo.png");
    expect(key).toMatch(/^images\/\d+-foo\.png$/);
  });

  it("supports a custom prefix", () => {
    const key = buildDefaultKey("/tmp/bar.webp", "uploads");
    expect(key).toMatch(/^uploads\/\d+-bar\.webp$/);
  });
});

describe("S3Provider.upload", () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "s3-test-"));
    tmpFile = path.join(tmpDir, "test.png");
    await fs.writeFile(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("uploads a file and returns the public URL", async () => {
    const provider = new S3Provider(validConfig);
    const result = await provider.upload({
      filePath: tmpFile,
      key: "images/test.png",
    });
    expect(result.publicUrl).toBe("https://media.example.com/images/test.png");
    expect(result.bucket).toBe("media");
    expect(result.key).toBe("images/test.png");
  });

  it("uses the bucket override when provided", async () => {
    const provider = new S3Provider(validConfig);
    const result = await provider.upload({
      filePath: tmpFile,
      key: "images/test.png",
      bucket: "alt-bucket",
    });
    expect(result.bucket).toBe("alt-bucket");
  });

  it("throws S3UploadError when the file does not exist", async () => {
    const provider = new S3Provider(validConfig);
    await expect(
      provider.upload({ filePath: "/does/not/exist.png", key: "images/x.png" }),
    ).rejects.toThrow(S3UploadError);
    await expect(
      provider.upload({ filePath: "/does/not/exist.png", key: "images/x.png" }),
    ).rejects.toThrow(/File not found/);
  });

  it("throws S3UploadError when path is a directory", async () => {
    const provider = new S3Provider(validConfig);
    await expect(
      provider.upload({ filePath: tmpDir, key: "images/x.png" }),
    ).rejects.toThrow(/not a file/);
  });
});
