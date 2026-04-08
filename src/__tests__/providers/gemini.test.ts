import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 1x1 transparent PNG as base64 — used as fake output from both code paths.
const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

// Mock @google/genai so tests are offline and deterministic.
vi.mock("@google/genai", () => {
  const generateContent = vi.fn(async (args: { model: string }) => {
    if (args.model.includes("bad-model")) {
      throw new Error("API error");
    }
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: { data: FAKE_PNG_BASE64, mimeType: "image/png" },
              },
            ],
          },
        },
      ],
    };
  });

  const generateImages = vi.fn(async () => ({
    generatedImages: [{ image: { imageBytes: FAKE_PNG_BASE64 } }],
  }));

  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent, generateImages },
    })),
    Modality: { IMAGE: "IMAGE", TEXT: "TEXT" },
  };
});

import { GeminiProvider } from "../../providers/gemini.js";

describe("GeminiProvider", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gemini-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("generates an image with the fast preset (Gemini Flash)", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "fast",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    expect(result.filePath).toMatch(/\.png$/);
    expect(result.thumbnailBase64).toBeTruthy();
    expect(result.modelUsed).toContain("flash");

    // File actually written to disk
    const stat = await fs.stat(result.filePath);
    expect(stat.isFile()).toBe(true);
  });

  it("generates an image with the quality preset (Imagen 3)", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "quality",
      aspectRatio: "16:9",
      format: "webp",
      outputDir: tmpDir,
    });
    expect(result.filePath).toMatch(/\.webp$/);
    expect(result.modelUsed).toContain("imagen");
  });

  it("writes jpeg when format is jpeg", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "balanced",
      aspectRatio: "1:1",
      format: "jpeg",
      outputDir: tmpDir,
    });
    expect(result.filePath).toMatch(/\.jpeg$/);
  });

  it("creates the output directory if it does not exist", async () => {
    const nested = path.join(tmpDir, "nested", "dir");
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "balanced",
      aspectRatio: "1:1",
      format: "png",
      outputDir: nested,
    });
    expect(result.filePath.startsWith(nested)).toBe(true);
  });
});
