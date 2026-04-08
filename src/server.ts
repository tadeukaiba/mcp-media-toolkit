import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./types.js";
import {
  generateImageInputSchema,
  handleGenerateImage,
  type GenerateImageArgs,
} from "./tools/generate-image.js";
import {
  uploadImageInputSchema,
  handleUploadImage,
  type UploadImageArgs,
} from "./tools/upload-image.js";
import {
  generateAndUploadInputSchema,
  handleGenerateAndUpload,
  type GenerateAndUploadArgs,
} from "./tools/generate-and-upload.js";

/**
 * Builds the MCP server and registers all tools.
 *
 * The server is configured at startup with a validated AppConfig. If S3 is not
 * configured, the upload tools are still registered but they'll return a
 * helpful "S3 not configured" error at call time. This is intentional so users
 * see the tools in their client and understand what's available.
 */
export function buildServer(config: AppConfig): McpServer {
  const server = new McpServer(
    { name: "mcp-media-toolkit", version: "0.1.0" },
    {
      instructions:
        "Tools for AI image generation (Gemini / Nano Banana) and upload to S3-compatible storage (Cloudflare R2, AWS S3, MinIO, etc.). Use generate_and_upload_gemini_s3 for the most common workflow: generate an image and get back a public URL in one call.",
    },
  );

  server.registerTool(
    "generate_image_gemini",
    {
      title: "Generate image with Gemini",
      description:
        "Generate an AI image using Google Gemini (Nano Banana) or Imagen 3. Returns the absolute path of the saved file plus a thumbnail preview. Does NOT upload — use upload_image_s3 or generate_and_upload_gemini_s3 if you need a public URL.",
      inputSchema: generateImageInputSchema,
    },
    async (args) => handleGenerateImage(args as GenerateImageArgs, config),
  );

  server.registerTool(
    "upload_image_s3",
    {
      title: "Upload image to S3-compatible storage",
      description:
        "Upload a local image file to S3-compatible storage (Cloudflare R2, AWS S3, MinIO, DigitalOcean Spaces, etc.) and return the public URL. Requires S3_* environment variables to be configured.",
      inputSchema: uploadImageInputSchema,
    },
    async (args) => handleUploadImage(args as UploadImageArgs, config),
  );

  server.registerTool(
    "generate_and_upload_gemini_s3",
    {
      title: "Generate image with Gemini and upload to S3",
      description:
        "Generate an AI image with Gemini (Nano Banana) and upload it to S3-compatible storage in a single call. Returns the public URL and a thumbnail preview. This is the most common workflow when you need a public URL for a generated image. Requires both GEMINI_API_KEY and S3_* environment variables.",
      inputSchema: generateAndUploadInputSchema,
    },
    async (args) =>
      handleGenerateAndUpload(args as GenerateAndUploadArgs, config),
  );

  return server;
}
