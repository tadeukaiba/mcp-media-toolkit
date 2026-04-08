#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, loadConfig } from "./config.js";
import { buildServer } from "./server.js";

/**
 * Entry point for the mcp-media-toolkit MCP server.
 *
 * Boots over stdio — the standard transport for local MCP servers. Clients
 * launch this process and communicate over stdin/stdout.
 *
 * Strategy: validate config up front with clear errors, then hand off to the
 * MCP server. Any config problem exits with code 1 and a message printed to
 * stderr so the MCP client shows it to the user.
 */
async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[mcp-media-toolkit] Configuration error:\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(`[mcp-media-toolkit] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
