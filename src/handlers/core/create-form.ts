/**
 * create_form — Create a new empty form.
 */

import { type ToolResult } from '../../types';
import { generateFormId, storeForm, createEmptySchema } from '../../form-manager';
import { jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'create_form',
  description:
    'Create a new empty form. Returns the formId and initial schema. ' +
    'Use add_form_component to add fields afterwards.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Human-readable name for the form (e.g. "Invoice Form")',
      },
      executionPlatform: {
        type: 'string',
        enum: ['Camunda Cloud', 'Camunda Platform'],
        description: 'Target execution platform',
      },
      executionPlatformVersion: {
        type: 'string',
        description: 'Target platform version (e.g. "8.8.0")',
      },
    },
  },
} as const;

export async function handleCreateForm(args: any): Promise<ToolResult> {
  const formId = generateFormId();
  const schema = createEmptySchema(args?.name);

  if (args?.executionPlatform) {
    schema.executionPlatform = args.executionPlatform;
  }
  if (args?.executionPlatformVersion) {
    schema.executionPlatformVersion = args.executionPlatformVersion;
  }

  storeForm(formId, { schema, name: args?.name, version: 0 });

  return jsonResult({
    formId,
    name: args?.name ?? null,
    schema,
  });
}
