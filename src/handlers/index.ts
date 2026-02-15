/**
 * Handler barrel — TOOL_REGISTRY, TOOL_DEFINITIONS, and dispatchToolCall.
 *
 * Each handler file co-locates its TOOL_DEFINITION alongside the handler
 * function. This barrel imports them all and builds the registry.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { type ToolResult } from '../types';
import { getForm } from '../form-manager';
import { pushSnapshot } from './core/form-history';

// ── Core handlers ──────────────────────────────────────────────────────────
import * as CreateForm from './core/create-form';
import * as ImportFormSchema from './core/import-form-schema';
import * as ExportForm from './core/export-form';
import * as DeleteForm from './core/delete-form';
import * as InspectForm from './core/inspect-form';
import * as AutoLayoutForm from './core/auto-layout-form';
import * as BatchFormOperations from './core/batch-form-operations';
import * as FormHistory from './core/form-history';

// ── Component handlers ─────────────────────────────────────────────────────
import * as AddFormComponent from './components/add-form-component';
import * as ModifyFormComponent from './components/modify-form-component';
import * as ListFormComponents from './components/list-form-components';

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
  {
    definition: ImportFormSchema.TOOL_DEFINITION,
    handler: ImportFormSchema.handleImportFormSchema,
  },
  { definition: ExportForm.TOOL_DEFINITION, handler: ExportForm.handleExportForm },
  { definition: DeleteForm.TOOL_DEFINITION, handler: DeleteForm.handleDeleteForm },
  { definition: InspectForm.TOOL_DEFINITION, handler: InspectForm.handleInspectForm },
  { definition: AutoLayoutForm.TOOL_DEFINITION, handler: AutoLayoutForm.handleAutoLayoutForm },
  {
    definition: BatchFormOperations.TOOL_DEFINITION,
    handler: BatchFormOperations.handleBatchFormOperations,
  },
  { definition: FormHistory.TOOL_DEFINITION, handler: FormHistory.handleFormHistory },

  // Component manipulation
  {
    definition: AddFormComponent.TOOL_DEFINITION,
    handler: AddFormComponent.handleAddFormComponent,
  },
  {
    definition: ModifyFormComponent.TOOL_DEFINITION,
    handler: ModifyFormComponent.handleModifyFormComponent,
  },
  {
    definition: ListFormComponents.TOOL_DEFINITION,
    handler: ListFormComponents.handleListFormComponents,
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

/**
 * Tools that should NOT auto-snapshot before dispatch.
 * - Read-only tools: no mutation to undo.
 * - create/import/clone: create new forms (no prior state to snapshot).
 * - delete: destroys the form (history cleared separately).
 * - form_history: manages its own undo/redo stacks.
 * - batch_form_operations: manages its own snapshot for atomic rollback.
 */
const SNAPSHOT_SKIP = new Set([
  'create_form',
  'import_form_schema',
  'delete_form',
  'export_form',
  'list_form_components',
  'inspect_form',
  'form_history',
  'batch_form_operations',
]);

/** Dispatch a tool call by name. */
export async function dispatchToolCall(toolName: string, args: any): Promise<ToolResult> {
  const handler = dispatchMap.get(toolName);
  if (!handler) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }
  try {
    // Auto-push undo snapshot before mutating operations
    if (!SNAPSHOT_SKIP.has(toolName) && args?.formId) {
      const form = getForm(args.formId);
      if (form) {
        pushSnapshot(args.formId, form.schema);
      }
    }
    return await handler(args);
  } catch (error) {
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, message);
  }
}
