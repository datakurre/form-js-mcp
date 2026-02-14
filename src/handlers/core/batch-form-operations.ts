/**
 * batch_form_operations — Execute multiple operations atomically with rollback on failure.
 */

import { type ToolResult, type FormSchema } from '../../types';
import { getForm, notifyFormChanged } from '../../form-manager';
import { validateArgs, requireForm, jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'batch_form_operations',
  description:
    'Execute multiple form operations atomically. If any operation fails, ' +
    'all changes are rolled back to the state before the batch started. ' +
    'Each operation is a tool call with name and arguments.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID (used for rollback)' },
      operations: {
        type: 'array',
        description: 'Array of operations to execute',
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name to call' },
            args: { type: 'object', description: 'Arguments for the tool' },
          },
          required: ['tool', 'args'],
        },
      },
    },
    required: ['formId', 'operations'],
  },
} as const;

export async function handleBatchFormOperations(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'operations']);
  const form = requireForm(args.formId);
  const operations: Array<{ tool: string; args: any }> = args.operations;

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('operations must be a non-empty array');
  }

  // Lazy import to avoid circular dependency
  const { dispatchToolCall } = await import('../index');

  // Snapshot the schema for rollback
  const snapshot: FormSchema = JSON.parse(JSON.stringify(form.schema));
  const snapshotVersion = form.version ?? 0;

  const results: Array<{ tool: string; success: boolean; result?: any; error?: string }> = [];

  for (const op of operations) {
    if (!op.tool || typeof op.tool !== 'string') {
      // Rollback
      form.schema = snapshot;
      form.version = snapshotVersion;
      notifyFormChanged(args.formId);
      return jsonResult({
        success: false,
        completedOperations: results.length,
        error: 'Each operation must have a "tool" string property',
        rolledBack: true,
        results,
      });
    }

    // Prevent recursive batch calls
    if (op.tool === 'batch_form_operations') {
      form.schema = snapshot;
      form.version = snapshotVersion;
      notifyFormChanged(args.formId);
      return jsonResult({
        success: false,
        completedOperations: results.length,
        error: 'Cannot nest batch_form_operations',
        rolledBack: true,
        results,
      });
    }

    try {
      const toolResult = await dispatchToolCall(op.tool, op.args ?? {});
      const parsed = JSON.parse(toolResult.content[0].text);
      results.push({ tool: op.tool, success: true, result: parsed });
    } catch (error: any) {
      // Rollback on failure
      const currentForm = getForm(args.formId);
      if (currentForm) {
        currentForm.schema = snapshot;
        currentForm.version = snapshotVersion;
        notifyFormChanged(args.formId);
      }

      results.push({
        tool: op.tool,
        success: false,
        error: error.message ?? String(error),
      });

      return jsonResult({
        success: false,
        completedOperations: results.length - 1,
        failedOperation: op.tool,
        error: error.message ?? String(error),
        rolledBack: true,
        results,
      });
    }
  }

  return jsonResult({
    success: true,
    completedOperations: results.length,
    results,
    message: `Successfully executed ${results.length} operations`,
  });
}
