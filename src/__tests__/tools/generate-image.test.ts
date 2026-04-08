import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

vi.mock("@google/genai", () => {
  const generateContent = vi.fn(async () => ({
    candidates: [
      {
        content: {
          parts: [{ inlineData: { data: FAKE_PNG_BASE64, mimeType: "image/png" } }],
        },
      },
    ],
  }));
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent },
    })),
  };
});

import { handleGenerateImage } from "../../tools/generate-image.js";
import type { AppConfig } from "../../types.js";

describe("handleGenerateImage", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gen-tool-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const makeConfig = (): AppConfig => ({
    gemini: { apiKey: "g-key" },
    s3: null,
    imageOutputDir: tmpDir,
  });

  it("returns a text block and an image block on success", async () => {
    const result = await handleGenerateImage(
      { prompt: "a cat", quality: "fast", aspect_ratio: "1:1", format: "png" },
      makeConfig(),
    );
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe("text");
    expect(result.content[1].type).toBe("image");
  });

  it("applies default quality/aspect_ratio/format when not provided", async () => {
    const result = await handleGenerateImage({ prompt: "a cat" }, makeConfig());
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("balanced");
    expect(text).toContain("1:1");
    expect(text).toContain("png");
  });

  it("uses the custom output_dir when provided", async () => {
    const customDir = path.join(tmpDir, "custom");
    const result = await handleGenerateImage(
      { prompt: "a cat", output_dir: customDir },
      makeConfig(),
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain(customDir);
  });
});
