/**
 * validate_form — Validate a form schema.
 */

import { type ToolResult } from '../../types';
import { validateArgs, requireForm, jsonResult } from '../helpers';
import { validateFormSchema } from '../../validator';

export const TOOL_DEFINITION = {
  name: 'validate_form',
  description:
    'Validate a form schema. Checks for duplicate keys/IDs, ' +
    'missing required properties, invalid field types, and structural issues.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to validate',
      },
      includeWarnings: {
        type: 'boolean',
        description: 'Include warning-level issues (default: true)',
      },
    },
    required: ['formId'],
  },
} as const;

export async function handleValidateForm(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const form = requireForm(args.formId);
  const includeWarnings = args.includeWarnings !== false;

  const result = validateFormSchema(form.schema);

  const issues = includeWarnings
    ? result.issues
    : result.issues.filter((i) => i.severity === 'error');

  return jsonResult({
    valid: result.valid,
    issueCount: issues.length,
    issues,
  });
}
