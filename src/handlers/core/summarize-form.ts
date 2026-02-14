/**
 * summarize_form — Return a structured summary of a form.
 */

import { type ToolResult, type FormComponent } from '../../types';
import { KEYED_FIELD_TYPES } from '../../constants';
import { validateArgs, requireForm, jsonResult, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'summarize_form',
  description:
    'Return a structured summary of a form: component counts by type, ' +
    'nesting depth, variable count, layout rows, validation usage, and conditionals.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to summarize',
      },
    },
    required: ['formId'],
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

export async function handleSummarizeForm(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const form = requireForm(args.formId);
  const schema = form.schema;

  const stats = collectStats(schema.components, 0);

  return jsonResult({
    formId: args.formId,
    name: form.name ?? null,
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
  });
}
