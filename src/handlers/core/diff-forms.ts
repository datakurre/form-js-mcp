/**
 * diff_forms — Structural diff between two form schemas.
 */

import { type ToolResult, type FormComponent } from '../../types';
import { validateArgs, requireForm, jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'diff_forms',
  description:
    'Compute a structural diff between two form schemas. ' +
    'Returns added, removed, and changed components.',
  inputSchema: {
    type: 'object',
    properties: {
      formId1: { type: 'string', description: 'First form ID' },
      formId2: { type: 'string', description: 'Second form ID' },
    },
    required: ['formId1', 'formId2'],
  },
} as const;

interface ComponentSummary {
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

function flattenComponents(
  components: FormComponent[],
  parentPath = ''
): Map<string, { component: FormComponent; path: string }> {
  const map = new Map<string, { component: FormComponent; path: string }>();
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const path = parentPath ? `${parentPath}[${i}]` : `[${i}]`;
    if (comp.id) {
      map.set(comp.id, { component: comp, path });
    }
    if (comp.components) {
      const nested = flattenComponents(comp.components, `${path}.components`);
      for (const [id, entry] of nested) {
        map.set(id, entry);
      }
    }
  }
  return map;
}

function toSummary(comp: FormComponent): ComponentSummary {
  return {
    id: comp.id ?? '(no id)',
    type: comp.type,
    ...(comp.key ? { key: comp.key } : {}),
    ...(comp.label ? { label: comp.label } : {}),
  };
}

/**
 * Compare two component values, ignoring nested `components` arrays
 * (those are handled by structural id-matching).
 */
function diffComponent(a: FormComponent, b: FormComponent): PropertyChange[] {
  const changes: PropertyChange[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    // Skip nested components — handled structurally
    if (key === 'components') continue;

    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];

    if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      changes.push({ property: key, before: valA ?? null, after: valB ?? null });
    }
  }

  return changes;
}

export async function handleDiffForms(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId1', 'formId2']);
  const form1 = requireForm(args.formId1);
  const form2 = requireForm(args.formId2);

  const map1 = flattenComponents(form1.schema.components);
  const map2 = flattenComponents(form2.schema.components);

  const added: ComponentSummary[] = [];
  const removed: ComponentSummary[] = [];
  const changed: ComponentDiff[] = [];

  // Find removed and changed
  for (const [id, { component: comp1 }] of map1) {
    const entry2 = map2.get(id);
    if (!entry2) {
      removed.push(toSummary(comp1));
    } else {
      const changes = diffComponent(comp1, entry2.component);
      if (changes.length > 0) {
        changed.push({ componentId: id, type: comp1.type, changes });
      }
    }
  }

  // Find added
  for (const [id, { component: comp2 }] of map2) {
    if (!map1.has(id)) {
      added.push(toSummary(comp2));
    }
  }

  const identical = added.length === 0 && removed.length === 0 && changed.length === 0;

  return jsonResult({
    formId1: args.formId1,
    formId2: args.formId2,
    identical,
    added,
    removed,
    changed,
    summary: identical
      ? 'Forms are structurally identical'
      : `${added.length} added, ${removed.length} removed, ${changed.length} changed`,
  });
}
