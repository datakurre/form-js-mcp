/**
 * modify_form_component — Delete or move a component within a form.
 *
 * Replaces the former `delete_form_component` and `move_form_component` tools
 * with a single structural-modification tool.
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
  name: 'modify_form_component',
  description:
    'Structural modification of a form component: delete or move. ' +
    'Use action "delete" to remove a component (and all nested children). ' +
    'Use action "move" to reorder within the same parent or reparent to a different container.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      action: {
        type: 'string',
        enum: ['delete', 'move'],
        description: '"delete" to remove, "move" to reorder/reparent',
      },
      componentId: { type: 'string', description: 'Component ID to delete or move' },
      targetParentId: {
        type: 'string',
        description: 'Target container ID for move (omit or null for root level)',
      },
      position: {
        type: 'number',
        description: 'Insert position index for move (default: append)',
      },
    },
    required: ['formId', 'action', 'componentId'],
  },
} as const;

export async function handleModifyFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'action', 'componentId']);

  switch (args.action) {
    case 'delete':
      return handleDelete(args);
    case 'move':
      return handleMove(args);
    default:
      throw new Error(`Invalid action: "${args.action}". Use "delete" or "move".`);
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

async function handleDelete(args: any): Promise<ToolResult> {
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const parentArr = findParentComponents(form.schema.components, args.componentId);
  if (!parentArr) throw new Error(`Cannot find parent of component ${args.componentId}`);

  const idx = parentArr.findIndex((c) => c.id === args.componentId);
  parentArr.splice(idx, 1);

  bumpVersion(form, args.formId);

  return mutationResult(form, {
    deleted: args.componentId,
    type: comp.type,
    message: `Deleted ${comp.type} component "${args.componentId}"`,
  });
}

// ── Move ───────────────────────────────────────────────────────────────────

async function handleMove(args: any): Promise<ToolResult> {
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

  bumpVersion(form, args.formId);

  return mutationResult(form, {
    moved: args.componentId,
    targetParent: args.targetParentId ?? 'root',
    position: pos ?? targetArr.length - 1,
    message: `Moved ${comp.type} "${args.componentId}" to ${args.targetParentId ?? 'root'}`,
  });
}
