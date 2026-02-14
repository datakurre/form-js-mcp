/**
 * import_form_schema — Import an existing form JSON schema.
 */

import { type ToolResult, type FormSchema } from '../../types';
import { generateFormId, storeForm } from '../../form-manager';
import { validateArgs, jsonResult, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'import_form_schema',
  description:
    'Import an existing form JSON schema into memory. ' +
    'Accepts a JSON string or object. Returns the formId and component count.',
  inputSchema: {
    type: 'object',
    properties: {
      schema: {
        description: 'Form schema as a JSON string or object',
      },
      name: {
        type: 'string',
        description: 'Human-readable name for the imported form',
      },
    },
    required: ['schema'],
  },
} as const;

export async function handleImportFormSchema(args: any): Promise<ToolResult> {
  validateArgs(args, ['schema']);

  let schema: FormSchema;
  if (typeof args.schema === 'string') {
    try {
      schema = JSON.parse(args.schema);
    } catch {
      throw new Error('Invalid JSON string for schema');
    }
  } else {
    schema = args.schema;
  }

  if (!schema || typeof schema !== 'object') {
    throw new Error('Schema must be a JSON object');
  }
  if (!Array.isArray(schema.components)) {
    throw new Error('Schema must have a "components" array');
  }
  if (schema.type && schema.type !== 'default') {
    throw new Error(`Unsupported schema type: ${schema.type}`);
  }

  // Ensure type is set
  schema.type = 'default';

  const formId = generateFormId();
  const name = args.name ?? schema.id ?? undefined;
  storeForm(formId, { schema, name, version: 0 });

  const componentCount = countComponents(schema.components);

  return jsonResult({
    formId,
    name: name ?? null,
    componentCount,
    message: `Imported form with ${componentCount} component(s)`,
  });
}
