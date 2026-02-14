/**
 * export_form — Export a form schema as JSON.
 */

import { type ToolResult } from '../../types';
import { validateArgs, requireForm } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'export_form',
  description:
    'Export a form schema as JSON. By default validates before export ' +
    'and blocks if there are errors (pass skipValidation=true to override).',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to export',
      },
      skipValidation: {
        type: 'boolean',
        description: 'Skip validation gate (default: false)',
      },
    },
    required: ['formId'],
  },
} as const;

export async function handleExportForm(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const form = requireForm(args.formId);

  const json = JSON.stringify(form.schema, null, 2);

  return {
    content: [{ type: 'text', text: json }],
  };
}
