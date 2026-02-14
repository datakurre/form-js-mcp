/**
 * delete_form_component — Remove a component from a form.
 */

import { type ToolResult } from '../../types';
import {
  validateArgs,
  requireForm,
  requireComponent,
  findParentComponents,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'delete_form_component',
  description:
    'Delete a component from a form by ID. If the component is a container, ' +
    'all nested children are also removed.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID to delete' },
    },
    required: ['formId', 'componentId'],
  },
} as const;

export async function handleDeleteFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const parentArr = findParentComponents(form.schema.components, args.componentId);
  if (!parentArr) throw new Error(`Cannot find parent of component ${args.componentId}`);

  const idx = parentArr.findIndex((c) => c.id === args.componentId);
  parentArr.splice(idx, 1);

  bumpVersion(form);

  return mutationResult(form, {
    deleted: args.componentId,
    type: comp.type,
    message: `Deleted ${comp.type} component "${args.componentId}"`,
  });
}
