/**
 * Handler barrel — TOOL_REGISTRY, TOOL_DEFINITIONS, and dispatchToolCall.
 *
 * Each handler file co-locates its TOOL_DEFINITION alongside the handler
 * function. This barrel imports them all and builds the registry.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { type ToolResult } from '../types';

// ── Core handlers ──────────────────────────────────────────────────────────
import * as CreateForm from './core/create-form';
import * as DeleteForm from './core/delete-form';
import * as InspectForm from './core/inspect-form';

// ── Component handlers ─────────────────────────────────────────────────────
import * as AddFormComponent from './components/add-form-component';
import * as ModifyFormComponent from './components/modify-form-component';

// ── Property handlers ──────────────────────────────────────────────────────
import * as SetProps from './properties/set-form-component-properties';

// ── Tool registration type ─────────────────────────────────────────────────

interface ToolRegistration {
  readonly definition: { readonly name: string; readonly [key: string]: unknown };
  readonly handler: (args: any) => Promise<ToolResult>;
}

// ── Registry ───────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: readonly ToolRegistration[] = [
  // Core form lifecycle
  { definition: CreateForm.TOOL_DEFINITION, handler: CreateForm.handleCreateForm },
  { definition: DeleteForm.TOOL_DEFINITION, handler: DeleteForm.handleDeleteForm },
  { definition: InspectForm.TOOL_DEFINITION, handler: InspectForm.handleInspectForm },

  // Component manipulation
  {
    definition: AddFormComponent.TOOL_DEFINITION,
    handler: AddFormComponent.handleAddFormComponent,
  },
  {
    definition: ModifyFormComponent.TOOL_DEFINITION,
    handler: ModifyFormComponent.handleModifyFormComponent,
  },

  // Property management
  { definition: SetProps.TOOL_DEFINITION, handler: SetProps.handleSetFormComponentProperties },
];

// ── Auto-derived exports ───────────────────────────────────────────────────

/** MCP tool definitions (passed to ListTools). */
export const TOOL_DEFINITIONS = TOOL_REGISTRY.map((r) => r.definition);

/** Tool name → handler lookup map. */
const dispatchMap = new Map<string, (args: any) => Promise<ToolResult>>(
  TOOL_REGISTRY.map((r) => [r.definition.name, r.handler])
);

/** Dispatch a tool call by name. */
export async function dispatchToolCall(toolName: string, args: any): Promise<ToolResult> {
  const handler = dispatchMap.get(toolName);
  if (!handler) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }
  try {
    return await handler(args);
  } catch (error) {
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, message);
  }
}
