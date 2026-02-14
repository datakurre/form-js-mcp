/**
 * delete_form — Remove a form from memory.
 */

import { type ToolResult } from '../../types';
import { deleteForm as removeForm } from '../../form-manager';
import { validateArgs, requireForm, jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'delete_form',
  description: 'Delete a form from memory.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to delete',
      },
    },
    required: ['formId'],
  },
} as const;

export async function handleDeleteForm(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  // Verify it exists first
  requireForm(args.formId);
  removeForm(args.formId);

  return jsonResult({
    deleted: args.formId,
    message: `Form ${args.formId} deleted`,
  });
}
