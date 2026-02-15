/**
 * list_form_components — List components in a form, or get details of one component.
 *
 * When `componentId` is provided, returns all properties of that specific component
 * (formerly the separate `get_form_component_properties` tool).
 * Otherwise lists components with optional type/parent filters.
 */

import { type ToolResult, type FormComponent } from '../../types';
import {
  validateArgs,
  requireForm,
  requireComponent,
  findComponentById,
  jsonResult,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'list_form_components',
  description:
    'List components in a form, or get detailed properties of a single component. ' +
    'Pass `componentId` to get all properties of that specific component. ' +
    'Without `componentId`, lists all components (optionally filtered by `type` or scoped to a `parentId` container).',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: {
        type: 'string',
        description: 'Get detailed properties of this specific component (omit to list all)',
      },
      type: { type: 'string', description: 'Filter by component type (list mode only)' },
      parentId: {
        type: 'string',
        description: 'List children of a specific container (list mode only)',
      },
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

  // ── Single-component detail mode ─────────────────────────────────────
  if (args.componentId) {
    const comp = requireComponent(form, args.componentId);
    const { components: _children, ...properties } = comp;
    return jsonResult({
      componentId: args.componentId,
      properties,
      hasChildren: !!_children?.length,
      childCount: _children?.length ?? 0,
    });
  }

  // ── List mode ────────────────────────────────────────────────────────
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
