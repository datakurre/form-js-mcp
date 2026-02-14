/**
 * list_forms — List all in-memory forms.
 */

import { type ToolResult } from '../../types';
import { getAllForms } from '../../form-manager';
import { jsonResult, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'list_forms',
  description: 'List all in-memory forms with their IDs, names, and component counts.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
} as const;

export async function handleListForms(): Promise<ToolResult> {
  const forms = getAllForms();
  const result = [...forms.entries()].map(([formId, state]) => ({
    formId,
    name: state.name ?? null,
    componentCount: countComponents(state.schema.components),
    version: state.version ?? 0,
  }));

  return jsonResult({
    forms: result,
    count: result.length,
  });
}
