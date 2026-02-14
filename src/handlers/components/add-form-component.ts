/**
 * add_form_component — Add a component to a form.
 */

import { type ToolResult } from '../../types';
import { CONTAINER_FIELD_TYPES } from '../../constants';
import {
  validateArgs,
  requireForm,
  mutationResult,
  bumpVersion,
  generateComponentId,
  isKeyedType,
  isSupportedType,
  findComponentById,
  collectAllKeys,
  countComponents,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'add_form_component',
  description:
    'Add a component (field) to a form. For keyed types (textfield, number, select, etc.) ' +
    'a key is auto-generated if not provided. Use parentId to nest inside a group or dynamiclist.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      type: { type: 'string', description: 'Field type (e.g. "textfield", "number", "select")' },
      key: { type: 'string', description: 'Data binding key (auto-generated for keyed types)' },
      label: { type: 'string', description: 'Display label' },
      parentId: { type: 'string', description: 'Parent container component ID (for nesting)' },
      position: { type: 'number', description: 'Insert position index (default: append)' },
      properties: {
        type: 'object',
        description: 'Additional field-specific properties (description, validate, layout, etc.)',
      },
    },
    required: ['formId', 'type'],
  },
} as const;

export async function handleAddFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'type']);
  const form = requireForm(args.formId);
  const { type, label, parentId, position } = args;

  if (!isSupportedType(type)) {
    throw new Error(`Unsupported field type: ${type}`);
  }

  // Determine target components array
  let targetComponents = form.schema.components;
  if (parentId) {
    const parent = findComponentById(form.schema.components, parentId);
    if (!parent) throw new Error(`Parent component not found: ${parentId}`);
    if (!(CONTAINER_FIELD_TYPES as readonly string[]).includes(parent.type)) {
      throw new Error(`Parent ${parentId} (type: ${parent.type}) is not a container`);
    }
    if (!parent.components) parent.components = [];
    targetComponents = parent.components;
  }

  // Build the component
  const id = generateComponentId(type, label);
  const component: any = { type, id, ...(args.properties ?? {}) };

  if (label !== undefined) component.label = label;

  // Handle key for keyed types
  if (isKeyedType(type)) {
    let key = args.key;
    if (!key) {
      key = label ? label.replaceAll(/[^\w]/g, '').slice(0, 30) : type;
      key = key.charAt(0).toLowerCase() + key.slice(1);
    }
    // Ensure uniqueness
    const existingKeys = collectAllKeys(form.schema.components);
    let finalKey = key;
    let suffix = 1;
    while (existingKeys.includes(finalKey)) {
      finalKey = `${key}${suffix}`;
      suffix++;
    }
    component.key = finalKey;
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
