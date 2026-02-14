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
import * as ImportFormSchema from './core/import-form-schema';
import * as ExportForm from './core/export-form';
import * as DeleteForm from './core/delete-form';
import * as ListForms from './core/list-forms';
import * as CloneForm from './core/clone-form';
import * as ValidateForm from './core/validate-form';
import * as SummarizeForm from './core/summarize-form';
import * as GetFormVariables from './core/get-form-variables';
import * as DiffForms from './core/diff-forms';
import * as AutoLayoutForm from './core/auto-layout-form';
import * as BatchFormOperations from './core/batch-form-operations';
import * as FormHistory from './core/form-history';

// ── Component handlers ─────────────────────────────────────────────────────
import * as AddFormComponent from './components/add-form-component';
import * as DeleteFormComponent from './components/delete-form-component';
import * as MoveFormComponent from './components/move-form-component';
import * as DuplicateFormComponent from './components/duplicate-form-component';
import * as ListFormComponents from './components/list-form-components';
import * as ReplaceFormComponent from './components/replace-form-component';

// ── Property handlers ──────────────────────────────────────────────────────
import * as GetProps from './properties/get-form-component-properties';
import * as SetProps from './properties/set-form-component-properties';
import * as SetValidation from './properties/set-form-validation';
import * as SetConditional from './properties/set-form-conditional';
import * as SetLayout from './properties/set-form-layout';
import * as SetOptions from './properties/set-form-options';

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
  { definition: ListForms.TOOL_DEFINITION, handler: ListForms.handleListForms },
  { definition: CloneForm.TOOL_DEFINITION, handler: CloneForm.handleCloneForm },
  { definition: ValidateForm.TOOL_DEFINITION, handler: ValidateForm.handleValidateForm },
  { definition: SummarizeForm.TOOL_DEFINITION, handler: SummarizeForm.handleSummarizeForm },
  {
    definition: GetFormVariables.TOOL_DEFINITION,
    handler: GetFormVariables.handleGetFormVariables,
  },
  { definition: DiffForms.TOOL_DEFINITION, handler: DiffForms.handleDiffForms },
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
    definition: DeleteFormComponent.TOOL_DEFINITION,
    handler: DeleteFormComponent.handleDeleteFormComponent,
  },
  {
    definition: MoveFormComponent.TOOL_DEFINITION,
    handler: MoveFormComponent.handleMoveFormComponent,
  },
  {
    definition: DuplicateFormComponent.TOOL_DEFINITION,
    handler: DuplicateFormComponent.handleDuplicateFormComponent,
  },
  {
    definition: ListFormComponents.TOOL_DEFINITION,
    handler: ListFormComponents.handleListFormComponents,
  },
  {
    definition: ReplaceFormComponent.TOOL_DEFINITION,
    handler: ReplaceFormComponent.handleReplaceFormComponent,
  },

  // Property management
  { definition: GetProps.TOOL_DEFINITION, handler: GetProps.handleGetFormComponentProperties },
  { definition: SetProps.TOOL_DEFINITION, handler: SetProps.handleSetFormComponentProperties },
  { definition: SetValidation.TOOL_DEFINITION, handler: SetValidation.handleSetFormValidation },
  { definition: SetConditional.TOOL_DEFINITION, handler: SetConditional.handleSetFormConditional },
  { definition: SetLayout.TOOL_DEFINITION, handler: SetLayout.handleSetFormLayout },
  { definition: SetOptions.TOOL_DEFINITION, handler: SetOptions.handleSetFormOptions },
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
