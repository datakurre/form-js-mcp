/**
 * add_form_component — Add a component to a form, or duplicate an existing one.
 *
 * When `sourceComponentId` is provided, deep-clones the source component
 * (with new IDs/keys) and inserts the copy after the original — replacing
 * the former `duplicate_form_component` tool.
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent } from '../../types';
import { CONTAINER_FIELD_TYPES } from '../../constants';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
  generateComponentId,
  isKeyedType,
  isSupportedType,
  findComponentById,
  findParentComponents,
  collectAllKeys,
  countComponents,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'add_form_component',
  description:
    'Add a component (field) to a form, or duplicate an existing one. ' +
    'For keyed types (textfield, number, select, etc.) a key is auto-generated if not provided. ' +
    'Use parentId to nest inside a group or dynamiclist. ' +
    'Use sourceComponentId to deep-clone an existing component (new IDs/keys), inserting the copy after the original.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      type: {
        type: 'string',
        description:
          'Field type (e.g. "textfield", "number", "select"). Not required when using sourceComponentId.',
      },
      key: { type: 'string', description: 'Data binding key (auto-generated for keyed types)' },
      label: { type: 'string', description: 'Display label' },
      parentId: { type: 'string', description: 'Parent container component ID (for nesting)' },
      position: { type: 'number', description: 'Insert position index (default: append)' },
      properties: {
        type: 'object',
        description: 'Additional field-specific properties (description, validate, layout, etc.)',
      },
      sourceComponentId: {
        type: 'string',
        description:
          'Deep-clone an existing component instead of creating a new one. ' +
          'The copy gets new IDs and keys and is inserted after the original.',
      },
    },
    required: ['formId'],
  },
} as const;

// ── Deep-clone helper (ported from duplicate_form_component) ───────────────

function deepCloneComponent(comp: FormComponent, existingKeys: string[]): FormComponent {
  const suffix = randomBytes(4).toString('hex');
  const clone: FormComponent = { ...comp, id: `${comp.type}_${suffix}` };
  if (clone.key) {
    let newKey = `${clone.key}_copy`;
    let counter = 1;
    while (existingKeys.includes(newKey)) {
      newKey = `${clone.key}_copy${counter}`;
      counter++;
    }
    clone.key = newKey;
    existingKeys.push(newKey);
  }
  if (clone.components) {
    clone.components = clone.components.map((c) => deepCloneComponent(c, existingKeys));
  }
  return clone;
}

/** Resolve the target components array for insertion. */
function resolveTarget(rootComponents: FormComponent[], parentId?: string): FormComponent[] {
  if (!parentId) return rootComponents;
  const parent = findComponentById(rootComponents, parentId);
  if (!parent) throw new Error(`Parent component not found: ${parentId}`);
  if (!(CONTAINER_FIELD_TYPES as readonly string[]).includes(parent.type)) {
    throw new Error(`Parent ${parentId} (type: ${parent.type}) is not a container`);
  }
  if (!parent.components) parent.components = [];
  return parent.components;
}

/** Generate a unique key for a keyed component. */
function resolveKey(
  rootComponents: FormComponent[],
  explicitKey: string | undefined,
  label: string | undefined,
  type: string
): string {
  let key = explicitKey;
  if (!key) {
    key = label ? label.replaceAll(/[^\w]/g, '').slice(0, 30) : type;
    key = key.charAt(0).toLowerCase() + key.slice(1);
  }
  const existingKeys = collectAllKeys(rootComponents);
  let finalKey = key;
  let suffix = 1;
  while (existingKeys.includes(finalKey)) {
    finalKey = `${key}${suffix}`;
    suffix++;
  }
  return finalKey;
}

export async function handleAddFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const form = requireForm(args.formId);

  // ── Duplicate mode (sourceComponentId) ─────────────────────────────────
  if (args.sourceComponentId) {
    requireComponent(form, args.sourceComponentId);
    const parentArr = findParentComponents(form.schema.components, args.sourceComponentId);
    if (!parentArr) throw new Error(`Cannot find parent of component ${args.sourceComponentId}`);

    const idx = parentArr.findIndex((c) => c.id === args.sourceComponentId);
    const existingKeys = collectAllKeys(form.schema.components);
    const clone = deepCloneComponent(parentArr[idx], existingKeys);

    parentArr.splice(idx + 1, 0, clone);
    bumpVersion(form, args.formId);

    return mutationResult(form, {
      component: clone,
      message: `Duplicated "${args.sourceComponentId}" as "${clone.id}"`,
    });
  }

  // ── Normal add mode ────────────────────────────────────────────────────
  if (!args.type) {
    throw new Error('Either "type" or "sourceComponentId" is required');
  }

  const { type, label, parentId, position } = args;
  if (!isSupportedType(type)) throw new Error(`Unsupported field type: ${type}`);

  const targetComponents = resolveTarget(form.schema.components, parentId);

  // Build the component
  const id = generateComponentId(type, label);
  const component: any = { type, id, ...(args.properties ?? {}) };
  if (label !== undefined) component.label = label;
  if (isKeyedType(type)) {
    component.key = resolveKey(form.schema.components, args.key, label, type);
  }

  // Insert at position or append
  if (position !== undefined && position >= 0 && position < targetComponents.length) {
    targetComponents.splice(position, 0, component);
  } else {
    targetComponents.push(component);
  }

  bumpVersion(form, args.formId);

  return mutationResult(form, {
    component,
    totalComponents: countComponents(form.schema.components),
    message: `Added ${type} component "${id}"`,
  });
}
