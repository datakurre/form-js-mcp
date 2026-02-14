/**
 * form-js-mcp server entry point.
 *
 * Thin shell that wires MCP SDK transport ↔ tool modules ↔ handlers.
 *
 * Tool modules are pluggable: each editor back-end (BPMN, DMN, Forms, …)
 * implements the ToolModule interface and registers its tools here.
 * Currently only the Form module is active.
 *
 * CLI usage:
 *   form-js-mcp [options]
 *
 * Options:
 *   --persist-dir <dir>   Enable file-backed persistence in <dir>
 *   --help                Show usage information
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { type ToolModule } from './module';
import { formModule } from './form-module';

// ── CLI argument parsing ───────────────────────────────────────────────────

interface CliOptions {
  persistDir?: string;
}

function printUsage(): void {
  console.error(`Usage: form-js-mcp [options]

Options:
  --persist-dir <dir>   Enable file-backed form persistence in <dir>.
                        Forms are saved as .form files and restored on startup.
  --help                Show this help message and exit.

Examples:
  form-js-mcp
  form-js-mcp --persist-dir ./forms

MCP configuration (.vscode/mcp.json):
  {
    "servers": {
      "form": {
        "command": "npx",
        "args": ["form-js-mcp", "--persist-dir", "./forms"]
      }
    }
  }
`);
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2); // skip node + script
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--persist-dir': {
        const dir = args[++i];
        if (!dir) {
          console.error('Error: --persist-dir requires a directory path');
          process.exit(1);
        }
        options.persistDir = dir;
        break;
      }
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  return options;
}

// ── Registered tool modules ────────────────────────────────────────────────
// Add new editor modules here when available.
const modules: ToolModule[] = [formModule];

const server = new Server(
  { name: 'form-js-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// ── Tool handlers ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: modules.flatMap((m) => m.toolDefinitions),
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any): Promise<any> => {
  const { name, arguments: args } = request.params;

  for (const mod of modules) {
    const result = mod.dispatch(name, args);
    if (result) return result;
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

// ── Resource handlers ──────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [],
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (_request: any) => {
  throw new McpError(ErrorCode.InvalidRequest, 'Resource not found');
});

// ── Prompt handlers ────────────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [],
}));

server.setRequestHandler(GetPromptRequestSchema, async (_request: any) => {
  throw new McpError(ErrorCode.InvalidRequest, 'Prompt not found');
});

async function main() {
  const _options = parseArgs(process.argv);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('form-js-mcp server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
