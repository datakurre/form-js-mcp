/**
 * export_form_to_file — Export form schema to filesystem with .form extension.
 */

import { writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { type ToolResult } from '../../types';
import { requireForm, jsonResult } from '../helpers';
import { validateFormSchema } from '../../validator';

export const TOOL_DEFINITION = {
  name: 'export_form_to_file',
  description:
    'Export a form schema to a file on the filesystem. The file will be saved with a .form extension. ' +
    'Validates the form before export (pass skipValidation=true to bypass). ' +
    'If returnSchema is true, also returns the schema in the response.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to export',
      },
      filePath: {
        type: 'string',
        description:
          'Path where the form should be saved (must end with .form). Can be absolute or relative.',
      },
      skipValidation: {
        type: 'boolean',
        description:
          'Skip validation gate (default: false). When false, export is blocked if there are validation errors.',
      },
      returnSchema: {
        type: 'boolean',
        description:
          'Include the schema in the response (default: false). When true, returns both file path and schema.',
      },
    },
    required: ['formId', 'filePath'],
  },
} as const;

export async function handleExportFormToFile(args: any): Promise<ToolResult> {
  if (!args?.formId) {
    throw new Error('formId is required');
  }
  if (!args?.filePath) {
    throw new Error('filePath is required');
  }

  const form = requireForm(args.formId);
  const schema = form.schema;

  // Validate schema unless skipValidation is true
  if (!args.skipValidation) {
    const { valid, issues } = validateFormSchema(schema);
    if (!valid) {
      const errors = issues.filter((i) => i.severity === 'error');
      throw new Error(
        `Export blocked: form has ${errors.length} validation error(s). ` +
          errors.map((e) => e.message).join('; ') +
          '. Pass skipValidation=true to export anyway.'
      );
    }
  }

  // Enforce .form extension
  let filePath = args.filePath as string;
  if (!filePath.endsWith('.form')) {
    // Add .form extension if missing
    filePath = filePath + '.form';
  }

  // Resolve to absolute path
  const absPath = resolve(filePath);

  // Write the file
  const json = JSON.stringify(schema, null, 2);
  writeFileSync(absPath, json, 'utf-8');

  const result: Record<string, any> = {
    success: true,
    filePath: absPath,
    fileName: basename(absPath),
    formId: args.formId,
    message: `Form exported successfully to ${absPath}`,
  };

  // Optionally include schema in response
  if (args.returnSchema) {
    result.schema = json;
  }

  return jsonResult(result);
}
