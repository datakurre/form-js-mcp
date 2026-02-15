/**
 * inspect_form — Unified read-only inspection of forms.
 *
 * Without `formId`, lists all forms. With `formId`, returns selected facets:
 * summary, validation, variables, diff, schema, components.
 */

import { type ToolResult, type FormComponent, type FormSchema, type FormState } from '../../types';
import { KEYED_FIELD_TYPES } from '../../constants';
import {
  requireForm,
  requireComponent,
  findComponentById,
  jsonResult,
  countComponents,
} from '../helpers';
import { validateFormSchema } from '../../validator';
import { getAllForms } from '../../form-manager';

export const TOOL_DEFINITION = {
  name: 'inspect_form',
  description:
    'Inspect forms. Without `formId`, lists all in-memory forms with IDs, names, and component counts. ' +
    'With `formId`, returns selected facets via the `include` array: ' +
    '"summary" (component counts, nesting depth, layout stats), ' +
    '"validation" (duplicate keys, missing properties, structural issues), ' +
    '"variables" (data-bound keys, expression references, conditional references), ' +
    '"diff" (structural diff — requires `compareFormId`), ' +
    '"schema" (export the full JSON schema — validates first unless `skipValidation` is true), ' +
    '"components" (list components or get single component detail via `componentId`). ' +
    'Defaults to ["summary", "validation", "variables"] when `include` is omitted.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to inspect. Omit to list all forms.',
      },
      include: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['summary', 'validation', 'variables', 'diff', 'schema', 'components'],
        },
        description: 'Which facets to include. Defaults to ["summary", "validation", "variables"]',
      },
      includeWarnings: {
        type: 'boolean',
        description: 'Include warning-level validation issues (default: true)',
      },
      compareFormId: {
        type: 'string',
        description: 'Second form ID for the "diff" facet. Required when include contains "diff".',
      },
      skipValidation: {
        type: 'boolean',
        description:
          'Skip validation gate for "schema" facet (default: false). ' +
          'When false, export is blocked if there are validation errors.',
      },
      componentId: {
        type: 'string',
        description:
          'For the "components" facet: get detailed properties of this specific component.',
      },
      componentType: {
        type: 'string',
        description: 'For the "components" facet: filter component list by type.',
      },
      parentId: {
        type: 'string',
        description: 'For the "components" facet: list only direct children of this container.',
      },
    },
  },
} as const;

interface FormStats {
  typeCounts: Record<string, number>;
  rows: Set<string>;
  hasValidation: boolean;
  hasConditionals: boolean;
  variableCount: number;
  maxDepth: number;
}

function mergeChildStats(parent: FormStats, child: FormStats): void {
  for (const [t, c] of Object.entries(child.typeCounts)) {
    parent.typeCounts[t] = (parent.typeCounts[t] ?? 0) + c;
  }
  for (const r of child.rows) {
    parent.rows.add(r);
  }
  if (child.hasValidation) {
    parent.hasValidation = true;
  }
  if (child.hasConditionals) {
    parent.hasConditionals = true;
  }
  parent.variableCount += child.variableCount;
  if (child.maxDepth > parent.maxDepth) {
    parent.maxDepth = child.maxDepth;
  }
}

function collectStats(components: FormComponent[], depth: number): FormStats {
  const stats: FormStats = {
    typeCounts: {},
    rows: new Set<string>(),
    hasValidation: false,
    hasConditionals: false,
    variableCount: 0,
    maxDepth: depth,
  };
  for (const comp of components) {
    stats.typeCounts[comp.type] = (stats.typeCounts[comp.type] ?? 0) + 1;
    if (comp.key && (KEYED_FIELD_TYPES as readonly string[]).includes(comp.type)) {
      stats.variableCount++;
    }
    if (comp.validate && Object.keys(comp.validate).length > 0) {
      stats.hasValidation = true;
    }
    if (comp.conditional?.hide) {
      stats.hasConditionals = true;
    }
    if (comp.layout?.row) {
      stats.rows.add(comp.layout.row);
    }
    if (comp.components?.length) {
      mergeChildStats(stats, collectStats(comp.components, depth + 1));
    }
  }
  return stats;
}

function extractVariables(components: FormComponent[]) {
  const inputKeys: string[] = [];
  const expressionFields: string[] = [];
  const conditionalFields: string[] = [];
  for (const comp of components) {
    if (comp.key) {
      inputKeys.push(comp.key);
    }
    if (comp.valuesExpression) {
      expressionFields.push(comp.id ?? comp.key ?? comp.type);
    }
    if (comp.conditional?.hide) {
      conditionalFields.push(comp.id ?? comp.key ?? comp.type);
    }
    if (comp.components) {
      const n = extractVariables(comp.components);
      inputKeys.push(...n.inputKeys);
      expressionFields.push(...n.expressionFields);
      conditionalFields.push(...n.conditionalFields);
    }
  }
  return { inputKeys, expressionFields, conditionalFields };
}

function flattenForDiff(components: FormComponent[]): Map<string, FormComponent> {
  const map = new Map<string, FormComponent>();
  for (const comp of components) {
    if (comp.id) {
      map.set(comp.id, comp);
    }
    if (comp.components) {
      for (const [id, e] of flattenForDiff(comp.components)) {
        map.set(id, e);
      }
    }
  }
  return map;
}

function diffComponent(a: FormComponent, b: FormComponent) {
  const changes: { property: string; before: unknown; after: unknown }[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'components') continue;
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];
    if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      changes.push({ property: key, before: valA ?? null, after: valB ?? null });
    }
  }
  return changes;
}

function buildSummaryFacet(schema: FormSchema, form: FormState): Record<string, any> {
  const stats = collectStats(schema.components, 0);
  return {
    schemaVersion: schema.schemaVersion ?? null,
    executionPlatform: schema.executionPlatform ?? null,
    totalComponents: countComponents(schema.components),
    componentsByType: stats.typeCounts,
    nestingDepth: stats.maxDepth,
    variableCount: stats.variableCount,
    layoutRows: stats.rows.size,
    hasValidation: stats.hasValidation,
    hasConditionals: stats.hasConditionals,
    version: form.version ?? 0,
  };
}

function buildValidationFacet(schema: FormSchema, includeWarnings: boolean): Record<string, any> {
  const validationResult = validateFormSchema(schema);
  const issues = includeWarnings
    ? validationResult.issues
    : validationResult.issues.filter((i) => i.severity === 'error');
  return { valid: validationResult.valid, issueCount: issues.length, issues };
}

function buildVariablesFacet(schema: FormSchema): Record<string, any> {
  const { inputKeys, expressionFields, conditionalFields } = extractVariables(schema.components);
  return {
    inputKeys: [...new Set(inputKeys)],
    expressionFieldCount: expressionFields.length,
    conditionalFieldCount: conditionalFields.length,
    total: new Set(inputKeys).size,
  };
}

function buildDiffFacet(schema: FormSchema, compareFormId: string): Record<string, any> {
  const form2 = requireForm(compareFormId);
  const map1 = flattenForDiff(schema.components);
  const map2 = flattenForDiff(form2.schema.components);
  const toSummary = (c: FormComponent) => ({
    id: c.id ?? '(no id)',
    type: c.type,
    ...(c.key ? { key: c.key } : {}),
    ...(c.label ? { label: c.label } : {}),
  });

  const added: Record<string, any>[] = [];
  const removed: Record<string, any>[] = [];
  const changed: Record<string, any>[] = [];

  for (const [id, comp1] of map1) {
    const comp2 = map2.get(id);
    if (!comp2) removed.push(toSummary(comp1));
    else {
      const changes = diffComponent(comp1, comp2);
      if (changes.length) changed.push({ componentId: id, type: comp1.type, changes });
    }
  }
  for (const [id, comp2] of map2) if (!map1.has(id)) added.push(toSummary(comp2));

  const identical = !added.length && !removed.length && !changed.length;
  return {
    compareFormId,
    identical,
    added,
    removed,
    changed,
    summary: identical
      ? 'Forms are structurally identical'
      : `${added.length} added, ${removed.length} removed, ${changed.length} changed`,
  };
}

function buildSchemaFacet(schema: FormSchema, skipValidation: boolean): string {
  if (!skipValidation) {
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
  return JSON.stringify(schema, null, 2);
}

interface ComponentSummary {
  id: string | undefined;
  type: string;
  key?: string;
  label?: string;
  childCount?: number;
}

function toComponentSummary(comp: FormComponent): ComponentSummary {
  const s: ComponentSummary = { id: comp.id, type: comp.type };
  if (comp.key) s.key = comp.key;
  if (comp.label) s.label = comp.label;
  if (comp.components) s.childCount = comp.components.length;
  return s;
}

function listDirectChildren(components: FormComponent[], typeFilter?: string): ComponentSummary[] {
  return components.filter((c) => !typeFilter || c.type === typeFilter).map(toComponentSummary);
}

function flattenComponentsList(
  components: FormComponent[],
  typeFilter?: string
): ComponentSummary[] {
  const results: ComponentSummary[] = [];
  for (const comp of components) {
    if (!typeFilter || comp.type === typeFilter) results.push(toComponentSummary(comp));
    if (comp.components) results.push(...flattenComponentsList(comp.components, typeFilter));
  }
  return results;
}

function buildComponentsFacet(schema: FormSchema, form: FormState, args: any): Record<string, any> {
  // Single-component detail mode
  if (args.componentId) {
    const comp = requireComponent(form, args.componentId);
    const { components: _children, ...properties } = comp;
    return {
      componentId: args.componentId,
      properties,
      hasChildren: !!_children?.length,
      childCount: _children?.length ?? 0,
    };
  }

  // List mode
  let components = schema.components;
  if (args.parentId) {
    const parent = findComponentById(schema.components, args.parentId);
    if (!parent) throw new Error(`Parent component not found: ${args.parentId}`);
    components = parent.components ?? [];
  }

  const results = args.parentId
    ? listDirectChildren(components, args.componentType)
    : flattenComponentsList(components, args.componentType);

  return { components: results, count: results.length };
}

export async function handleInspectForm(args: any): Promise<ToolResult> {
  // ── List-all mode (no formId) ──────────────────────────────────────────
  if (!args?.formId) {
    const forms = getAllForms();
    const list = [...forms.entries()].map(([formId, state]) => ({
      formId,
      name: state.name ?? null,
      componentCount: countComponents(state.schema.components),
      version: state.version ?? 0,
    }));
    return jsonResult({ forms: list, count: list.length });
  }

  const form = requireForm(args.formId);
  const schema = form.schema;

  const include: string[] = args.include ?? ['summary', 'validation', 'variables'];
  const includeWarnings = args.includeWarnings !== false;

  const result: Record<string, any> = {
    formId: args.formId,
    name: form.name ?? null,
  };

  if (include.includes('summary')) {
    result.summary = buildSummaryFacet(schema, form);
  }
  if (include.includes('validation')) {
    result.validation = buildValidationFacet(schema, includeWarnings);
  }
  if (include.includes('variables')) {
    result.variables = buildVariablesFacet(schema);
  }
  if (include.includes('diff')) {
    if (!args.compareFormId) {
      throw new Error('The "diff" facet requires a "compareFormId" parameter');
    }
    result.diff = buildDiffFacet(schema, args.compareFormId);
  }
  if (include.includes('schema')) {
    result.schema = buildSchemaFacet(schema, !!args.skipValidation);
  }
  if (include.includes('components')) {
    result.components = buildComponentsFacet(schema, form, args);
  }

  return jsonResult(result);
}
