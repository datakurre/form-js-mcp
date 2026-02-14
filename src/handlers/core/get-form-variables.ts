/**
 * get_form_variables — Extract all variable keys referenced in a form schema.
 */

import { type ToolResult, type FormComponent } from '../../types';
import { validateArgs, requireForm, jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'get_form_variables',
  description:
    'Extract all variable keys used in a form — data-bound keys, ' +
    'expression references, and conditional references.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
    },
    required: ['formId'],
  },
} as const;

function extractVariables(components: FormComponent[]): {
  inputKeys: string[];
  expressionFields: string[];
  conditionalFields: string[];
} {
  const inputKeys: string[] = [];
  const expressionFields: string[] = [];
  const conditionalFields: string[] = [];

  for (const comp of components) {
    if (comp.key) inputKeys.push(comp.key);

    // Check for expression bindings
    if (comp.valuesExpression) {
      expressionFields.push(comp.id ?? comp.key ?? comp.type);
    }

    // Check conditional
    if (comp.conditional?.hide) {
      conditionalFields.push(comp.id ?? comp.key ?? comp.type);
    }

    if (comp.components) {
      const nested = extractVariables(comp.components);
      inputKeys.push(...nested.inputKeys);
      expressionFields.push(...nested.expressionFields);
      conditionalFields.push(...nested.conditionalFields);
    }
  }

  return { inputKeys, expressionFields, conditionalFields };
}

export async function handleGetFormVariables(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const form = requireForm(args.formId);

  const { inputKeys, expressionFields, conditionalFields } = extractVariables(
    form.schema.components
  );

  return jsonResult({
    inputKeys: [...new Set(inputKeys)],
    expressionFieldCount: expressionFields.length,
    conditionalFieldCount: conditionalFields.length,
    total: new Set(inputKeys).size,
  });
}
