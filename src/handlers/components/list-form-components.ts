/**
 * list_form_components — List components in a form.
 */

import { type ToolResult, type FormComponent } from '../../types';
import { validateArgs, requireForm, findComponentById, jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'list_form_components',
  description:
    'List components in a form with optional type filter. ' +
    'Use parentId to list only children of a specific container.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      type: { type: 'string', description: 'Filter by component type' },
      parentId: { type: 'string', description: 'List children of a specific container' },
    },
    required: ['formId'],
  },
} as const;

interface ComponentSummary {
  id: string | undefined;
  type: string;
  key?: string;
  label?: string;
  childCount?: number;
}

function listDirectChildren(components: FormComponent[], typeFilter?: string): ComponentSummary[] {
  const results: ComponentSummary[] = [];
  for (const comp of components) {
    if (!typeFilter || comp.type === typeFilter) {
      const summary: ComponentSummary = { id: comp.id, type: comp.type };
      if (comp.key) summary.key = comp.key;
      if (comp.label) summary.label = comp.label;
      if (comp.components) summary.childCount = comp.components.length;
      results.push(summary);
    }
  }
  return results;
}

function flattenComponents(components: FormComponent[], typeFilter?: string): ComponentSummary[] {
  const results: ComponentSummary[] = [];
  for (const comp of components) {
    if (!typeFilter || comp.type === typeFilter) {
      const summary: ComponentSummary = { id: comp.id, type: comp.type };
      if (comp.key) summary.key = comp.key;
      if (comp.label) summary.label = comp.label;
      if (comp.components) summary.childCount = comp.components.length;
      results.push(summary);
    }
    if (comp.components) {
      results.push(...flattenComponents(comp.components, typeFilter));
    }
  }
  return results;
}

export async function handleListFormComponents(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const form = requireForm(args.formId);

  let components = form.schema.components;
  if (args.parentId) {
    const parent = findComponentById(form.schema.components, args.parentId);
    if (!parent) throw new Error(`Parent component not found: ${args.parentId}`);
    components = parent.components ?? [];
  }

  const results = args.parentId
    ? listDirectChildren(components, args.type)
    : flattenComponents(components, args.type);

  return jsonResult({
    components: results,
    count: results.length,
  });
}
