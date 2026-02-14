/**
 * move_form_component — Move/reorder a component within a form.
 */

import { type ToolResult } from '../../types';
import { CONTAINER_FIELD_TYPES } from '../../constants';
import {
  validateArgs,
  requireForm,
  requireComponent,
  findComponentById,
  findParentComponents,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'move_form_component',
  description:
    'Move a component to a new position within the form. ' +
    'Supports reordering within the same parent or reparenting to a different container.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID to move' },
      targetParentId: {
        type: 'string',
        description: 'Target container ID (omit or null for root level)',
      },
      position: { type: 'number', description: 'Insert position index (default: append)' },
    },
    required: ['formId', 'componentId'],
  },
} as const;

export async function handleMoveFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  // Remove from current parent
  const sourceArr = findParentComponents(form.schema.components, args.componentId);
  if (!sourceArr) throw new Error(`Cannot find parent of component ${args.componentId}`);
  const srcIdx = sourceArr.findIndex((c) => c.id === args.componentId);
  sourceArr.splice(srcIdx, 1);

  // Determine target array
  let targetArr = form.schema.components;
  if (args.targetParentId) {
    const parent = findComponentById(form.schema.components, args.targetParentId);
    if (!parent) throw new Error(`Target parent not found: ${args.targetParentId}`);
    if (!(CONTAINER_FIELD_TYPES as readonly string[]).includes(parent.type)) {
      throw new Error(`Target ${args.targetParentId} is not a container`);
    }
    if (!parent.components) parent.components = [];
    targetArr = parent.components;
  }

  // Insert at position or append
  const pos = args.position;
  if (pos !== undefined && pos >= 0 && pos <= targetArr.length) {
    targetArr.splice(pos, 0, comp);
  } else {
    targetArr.push(comp);
  }

  bumpVersion(form);

  return mutationResult(form, {
    moved: args.componentId,
    targetParent: args.targetParentId ?? 'root',
    position: pos ?? targetArr.length - 1,
    message: `Moved ${comp.type} "${args.componentId}" to ${args.targetParentId ?? 'root'}`,
  });
}
