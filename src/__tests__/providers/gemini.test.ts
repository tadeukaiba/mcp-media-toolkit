import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 1x1 transparent PNG as base64 — used as fake output for the mocked SDK.
const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

// Track calls so tests can assert what was sent to the SDK.
const generateContentCalls: Array<{ model: string; config?: unknown }> = [];

// Mock @google/genai so tests are offline and deterministic. All three quality
// presets now go through ai.models.generateContent() with different model IDs.
vi.mock("@google/genai", () => {
  const generateContent = vi.fn(async (args: { model: string; config?: unknown }) => {
    generateContentCalls.push({ model: args.model, config: args.config });
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

  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent },
    })),
  };
});

import { GeminiProvider, slugifyPrompt } from "../../providers/gemini.js";

describe("slugifyPrompt", () => {
  it("lowercases and joins with dashes", () => {
    expect(slugifyPrompt("Orange Tabby Cat")).toBe("orange-tabby-cat");
  });

  it("strips leading filler words so the slug starts meaningful", () => {
    expect(slugifyPrompt("A fluffy orange tabby cat curled up on top of a book")).toBe(
      "fluffy-orange-tabby-cat-curled-up",
    );
  });

  it("keeps at most 6 words after the leading-filler strip", () => {
    // "a" in the middle is kept — only leading filler is stripped, because
    // removing filler mid-string would risk dropping meaningful words in
    // edge cases. The word cap then takes the next 6.
    expect(
      slugifyPrompt("minimalist modern logo for a developer tool called pulse"),
    ).toBe("minimalist-modern-logo-for-a-developer");
  });

  it("handles punctuation and multiple spaces", () => {
    expect(slugifyPrompt('A "red" fox, curled up!')).toBe("red-fox-curled-up");
  });

  it("returns empty string when no alphanumeric content", () => {
    expect(slugifyPrompt("!!!")).toBe("");
    expect(slugifyPrompt("   ")).toBe("");
  });

  it("caps total length at 40 chars", () => {
    const longPrompt = "supercalifragilisticexpialidocious wonderful magical extraordinary";
    const slug = slugifyPrompt(longPrompt);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).not.toMatch(/-$/); // no trailing dash after the cut
  });
});

describe("GeminiProvider", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gemini-test-"));
    generateContentCalls.length = 0;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("uses the Nano Banana (flash image) model for the fast preset", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "fast",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    expect(result.modelUsed).toBe("gemini-2.5-flash-image");
    expect(generateContentCalls[0].model).toBe("gemini-2.5-flash-image");
  });

  it("uses Nano Banana 2 for the balanced preset", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "balanced",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    expect(result.modelUsed).toBe("gemini-3.1-flash-image-preview");
  });

  it("uses Nano Banana Pro for the quality preset", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "a cat",
      quality: "quality",
      aspectRatio: "16:9",
      format: "webp",
      outputDir: tmpDir,
    });
    expect(result.modelUsed).toBe("gemini-3-pro-image-preview");
    expect(result.filePath).toMatch(/\.webp$/);
  });

  it("passes aspectRatio and imageSize via config.imageConfig", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    await provider.generate({
      prompt: "a cat",
      quality: "balanced",
      aspectRatio: "16:9",
      format: "png",
      outputDir: tmpDir,
    });
    const cfg = generateContentCalls[0].config as {
      imageConfig?: { aspectRatio?: string; imageSize?: string };
      responseModalities?: string[];
    };
    expect(cfg.imageConfig?.aspectRatio).toBe("16:9");
    expect(cfg.imageConfig?.imageSize).toBe("2K");
    expect(cfg.responseModalities).toEqual(["TEXT", "IMAGE"]);
  });

  it("uses 4K imageSize for quality preset and 1K for fast", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    await provider.generate({
      prompt: "a cat",
      quality: "quality",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    await provider.generate({
      prompt: "a cat",
      quality: "fast",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    expect(
      (generateContentCalls[0].config as { imageConfig: { imageSize: string } }).imageConfig.imageSize,
    ).toBe("4K");
    expect(
      (generateContentCalls[1].config as { imageConfig: { imageSize: string } }).imageConfig.imageSize,
    ).toBe("1K");
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
    const stat = await fs.stat(result.filePath);
    expect(stat.isFile()).toBe(true);
  });

  it("includes a prompt slug in the generated filename", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "A minimalist modern logo for Pulse",
      quality: "fast",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    // Filename shape: gemini-<timestamp>-<slug>.<ext>
    expect(result.filePath).toMatch(
      /gemini-\d+-minimalist-modern-logo-for-pulse\.png$/,
    );
  });

  it("falls back to timestamp-only name when slug would be empty", async () => {
    const provider = new GeminiProvider({ apiKey: "test" });
    const result = await provider.generate({
      prompt: "!!!",
      quality: "fast",
      aspectRatio: "1:1",
      format: "png",
      outputDir: tmpDir,
    });
    expect(result.filePath).toMatch(/gemini-\d+\.png$/);
  });
});
