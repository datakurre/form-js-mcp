/**
 * export_form — Export a form schema as JSON.
 */

import { type ToolResult } from '../../types';
import { validateArgs, requireForm } from '../helpers';
import { validateFormSchema } from '../../validator';

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

  // Validate before export unless explicitly skipped
  if (!args.skipValidation) {
    const { valid, issues } = validateFormSchema(form.schema);
    if (!valid) {
      const errors = issues.filter((i) => i.severity === 'error');
      throw new Error(
        `Export blocked: form has ${errors.length} validation error(s). ` +
          errors.map((e) => e.message).join('; ') +
          '. Pass skipValidation=true to export anyway.'
      );
    }
  }

  const json = JSON.stringify(form.schema, null, 2);

  return {
    content: [{ type: 'text', text: json }],
  };
}
