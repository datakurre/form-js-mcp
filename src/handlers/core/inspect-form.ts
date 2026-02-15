/**
 * inspect_form — Unified read-only inspection of forms.
 *
 * Merges the former `validate_form`, `summarize_form`, `get_form_variables`,
 * `diff_forms`, and `list_forms` into a single tool.
 *
 * When `formId` is omitted, returns the list of all forms (former `list_forms`).
 * When `formId` is provided, returns selected facets about that form.
 */

import { type ToolResult, type FormComponent, type FormSchema, type FormState } from '../../types';
import { KEYED_FIELD_TYPES } from '../../constants';
import { requireForm, jsonResult, countComponents } from '../helpers';
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
    '"diff" (structural diff — requires `compareFormId`). ' +
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
          enum: ['summary', 'validation', 'variables', 'diff'],
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
    },
  },
} as const;

// ── Summary stats ──────────────────────────────────────────────────────────

interface FormStats {
  typeCounts: Record<string, number>;
  rows: Set<string>;
  hasValidation: boolean;
  hasConditionals: boolean;
  variableCount: number;
  maxDepth: number;
}

function isKeyedVariable(comp: FormComponent): boolean {
  return !!comp.key && (KEYED_FIELD_TYPES as readonly string[]).includes(comp.type);
}

function hasValidationRules(comp: FormComponent): boolean {
  return !!comp.validate && Object.keys(comp.validate).length > 0;
}

function mergeChildStats(parent: FormStats, child: FormStats): void {
  for (const [t, c] of Object.entries(child.typeCounts)) {
    parent.typeCounts[t] = (parent.typeCounts[t] ?? 0) + c;
  }
  for (const r of child.rows) parent.rows.add(r);
  if (child.hasValidation) parent.hasValidation = true;
  if (child.hasConditionals) parent.hasConditionals = true;
  parent.variableCount += child.variableCount;
  if (child.maxDepth > parent.maxDepth) parent.maxDepth = child.maxDepth;
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
    if (isKeyedVariable(comp)) stats.variableCount++;
    if (hasValidationRules(comp)) stats.hasValidation = true;
    if (comp.conditional?.hide) stats.hasConditionals = true;
    if (comp.layout?.row) stats.rows.add(comp.layout.row);

    if (comp.components?.length) {
      mergeChildStats(stats, collectStats(comp.components, depth + 1));
    }
  }

  return stats;
}

// ── Variable extraction ────────────────────────────────────────────────────

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
    if (comp.valuesExpression) {
      expressionFields.push(comp.id ?? comp.key ?? comp.type);
    }
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

// ── Diff logic (ported from diff_forms) ────────────────────────────────────

interface DiffComponentSummary {
  id: string;
  type: string;
  key?: string;
  label?: string;
}

interface PropertyChange {
  property: string;
  before: unknown;
  after: unknown;
}

interface ComponentDiff {
  componentId: string;
  type: string;
  changes: PropertyChange[];
}

function flattenForDiff(components: FormComponent[]): Map<string, FormComponent> {
  const map = new Map<string, FormComponent>();
  for (const comp of components) {
    if (comp.id) map.set(comp.id, comp);
    if (comp.components) {
      for (const [id, entry] of flattenForDiff(comp.components)) {
        map.set(id, entry);
      }
    }
  }
  return map;
}

function toDiffSummary(comp: FormComponent): DiffComponentSummary {
  return {
    id: comp.id ?? '(no id)',
    type: comp.type,
    ...(comp.key ? { key: comp.key } : {}),
    ...(comp.label ? { label: comp.label } : {}),
  };
}

function diffComponent(a: FormComponent, b: FormComponent): PropertyChange[] {
  const changes: PropertyChange[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    if (key === 'components') continue;
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];
    if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      changes.push({ property: key, before: valA ?? null, after: valB ?? null });
    }
  }
  return changes;
}

// ── Facet builders ─────────────────────────────────────────────────────────

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

  const added: DiffComponentSummary[] = [];
  const removed: DiffComponentSummary[] = [];
  const changed: ComponentDiff[] = [];

  for (const [id, comp1] of map1) {
    const comp2 = map2.get(id);
    if (!comp2) {
      removed.push(toDiffSummary(comp1));
    } else {
      const changes = diffComponent(comp1, comp2);
      if (changes.length > 0) {
        changed.push({ componentId: id, type: comp1.type, changes });
      }
    }
  }
  for (const [id, comp2] of map2) {
    if (!map1.has(id)) {
      added.push(toDiffSummary(comp2));
    }
  }

  const identical = added.length === 0 && removed.length === 0 && changed.length === 0;
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

// ── Main handler ───────────────────────────────────────────────────────────

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

  if (include.includes('summary')) result.summary = buildSummaryFacet(schema, form);
  if (include.includes('validation')) {
    result.validation = buildValidationFacet(schema, includeWarnings);
  }
  if (include.includes('variables')) result.variables = buildVariablesFacet(schema);
  if (include.includes('diff')) {
    if (!args.compareFormId) {
      throw new Error('The "diff" facet requires a "compareFormId" parameter');
    }
    result.diff = buildDiffFacet(schema, args.compareFormId);
  }

  return jsonResult(result);
}
