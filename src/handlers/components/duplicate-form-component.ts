/**
 * duplicate_form_component — Deep-clone a component with new IDs.
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent } from '../../types';
import {
  validateArgs,
  requireForm,
  requireComponent,
  findParentComponents,
  collectAllKeys,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'duplicate_form_component',
  description:
    'Deep-clone a component (with new IDs and keys), inserting the copy after the original.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID to duplicate' },
    },
    required: ['formId', 'componentId'],
  },
} as const;

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

export async function handleDuplicateFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  requireComponent(form, args.componentId);

  const parentArr = findParentComponents(form.schema.components, args.componentId);
  if (!parentArr) throw new Error(`Cannot find parent of component ${args.componentId}`);

  const idx = parentArr.findIndex((c) => c.id === args.componentId);
  const existingKeys = collectAllKeys(form.schema.components);
  const clone = deepCloneComponent(parentArr[idx], existingKeys);

  parentArr.splice(idx + 1, 0, clone);
  bumpVersion(form);

  return mutationResult(form, {
    component: clone,
    message: `Duplicated "${args.componentId}" as "${clone.id}"`,
  });
}
