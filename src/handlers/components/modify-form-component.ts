/**
 * modify_form_component — Delete, move, or auto-layout components within a form.
 *
 * Replaces the former `delete_form_component`, `move_form_component`, and
 * `auto_layout_form` tools with a single structural-modification tool.
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent } from '../../types';
import { CONTAINER_FIELD_TYPES, DEFAULT_COLUMNS, PRESENTATION_FIELD_TYPES } from '../../constants';
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
    'Structural modification of form components: delete, move, or auto-layout. ' +
    'Use action "delete" to remove a component (and all nested children). ' +
    'Use action "move" to reorder within the same parent or reparent to a different container. ' +
    'Use action "auto-layout" to auto-assign grid layout to all components (componentId not required).',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      action: {
        type: 'string',
        enum: ['delete', 'move', 'auto-layout'],
        description:
          '"delete" to remove, "move" to reorder/reparent, "auto-layout" to assign grid layout',
      },
      componentId: {
        type: 'string',
        description: 'Component ID to delete or move (not required for auto-layout)',
      },
      targetParentId: {
        type: 'string',
        description: 'Target container ID for move (omit or null for root level)',
      },
      position: {
        type: 'number',
        description: 'Insert position index for move (default: append)',
      },
      strategy: {
        type: 'string',
        enum: ['single-column', 'two-column', 'compact'],
        description:
          'Layout strategy for auto-layout (default: "single-column"). ' +
          '"single-column" = full width, "two-column" = side-by-side pairs, "compact" = auto-size by type.',
      },
      columns: {
        type: 'number',
        description: `Grid width for auto-layout (default: ${DEFAULT_COLUMNS})`,
      },
    },
    required: ['formId', 'action'],
  },
} as const;

export async function handleModifyFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'action']);

  switch (args.action) {
    case 'delete':
      return handleDelete(args);
    case 'move':
      return handleMove(args);
    case 'auto-layout':
      return handleAutoLayout(args);
    default:
      throw new Error(`Invalid action: "${args.action}". Use "delete", "move", or "auto-layout".`);
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

async function handleDelete(args: any): Promise<ToolResult> {
  if (!args.componentId) throw new Error('"componentId" is required for delete action');
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
  if (!args.componentId) throw new Error('"componentId" is required for move action');
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

// ── Auto-layout (ported from auto_layout_form) ────────────────────────────

type Strategy = 'single-column' | 'two-column' | 'compact';

/** Full-width presentation types that should always span the full row. */
const FULL_WIDTH_TYPES = new Set([
  'text',
  'html',
  'separator',
  'spacer',
  'table',
  'documentPreview',
  'image',
  'group',
  'dynamiclist',
  'iframe',
  'button',
]);

function generateRowId(): string {
  return `Row_${randomBytes(3).toString('hex')}`;
}

function isPresentationType(type: string): boolean {
  return (PRESENTATION_FIELD_TYPES as readonly string[]).includes(type);
}

function layoutSingleColumn(components: FormComponent[], gridWidth: number): number {
  let count = 0;
  for (const comp of components) {
    if (!comp.layout) comp.layout = {};
    comp.layout.columns = gridWidth;
    delete comp.layout.row;
    count++;

    // Recurse into containers
    if (comp.components) {
      count += layoutSingleColumn(comp.components, gridWidth);
    }
  }
  return count;
}

function layoutTwoColumn(components: FormComponent[], gridWidth: number): number {
  const halfWidth = Math.floor(gridWidth / 2);
  let count = 0;
  let pendingPair: FormComponent | undefined;
  let currentRow: string | undefined;

  for (const comp of components) {
    if (!comp.layout) comp.layout = {};

    // Full-width types always get their own row
    if (FULL_WIDTH_TYPES.has(comp.type)) {
      // Flush pending pair first
      if (pendingPair) {
        pendingPair.layout!.columns = gridWidth;
        delete pendingPair.layout!.row;
        count++;
        pendingPair = undefined;
        currentRow = undefined;
      }
      comp.layout.columns = gridWidth;
      delete comp.layout.row;
      count++;

      if (comp.components) {
        count += layoutTwoColumn(comp.components, gridWidth);
      }
      continue;
    }

    // Pair regular fields side-by-side
    if (!pendingPair) {
      pendingPair = comp;
      currentRow = generateRowId();
    } else {
      // Complete the pair
      pendingPair.layout!.columns = halfWidth;
      pendingPair.layout!.row = currentRow!;
      comp.layout.columns = gridWidth - halfWidth;
      comp.layout.row = currentRow!;
      count += 2;
      pendingPair = undefined;
      currentRow = undefined;
    }
  }

  // Handle trailing unpaired field
  if (pendingPair) {
    pendingPair.layout!.columns = gridWidth;
    delete pendingPair.layout!.row;
    count++;
  }

  return count;
}

function layoutCompact(components: FormComponent[], gridWidth: number): number {
  let count = 0;
  let remainingInRow = gridWidth;
  let currentRow: string | undefined;

  for (const comp of components) {
    if (!comp.layout) comp.layout = {};

    // Full-width types always get their own row
    if (FULL_WIDTH_TYPES.has(comp.type)) {
      // Start fresh row
      remainingInRow = gridWidth;
      currentRow = undefined;
      comp.layout.columns = gridWidth;
      delete comp.layout.row;
      count++;

      if (comp.components) {
        count += layoutCompact(comp.components, gridWidth);
      }
      continue;
    }

    // Determine natural width based on type
    let naturalWidth: number;
    if (comp.type === 'checkbox') {
      naturalWidth = Math.max(4, Math.floor(gridWidth / 4));
    } else if (comp.type === 'number' || comp.type === 'datetime') {
      naturalWidth = Math.max(4, Math.floor(gridWidth / 3));
    } else if (isPresentationType(comp.type)) {
      naturalWidth = gridWidth;
    } else {
      // textfield, textarea, select, radio, etc.
      naturalWidth = Math.floor(gridWidth / 2);
    }

    // Ensure at least width 1
    naturalWidth = Math.max(1, Math.min(naturalWidth, gridWidth));

    // Does it fit on current row?
    if (naturalWidth > remainingInRow) {
      // Start a new row
      remainingInRow = gridWidth;
      currentRow = undefined;
    }

    if (!currentRow) {
      currentRow = generateRowId();
    }

    comp.layout.columns = naturalWidth;
    comp.layout.row = currentRow;
    remainingInRow -= naturalWidth;
    count++;

    if (remainingInRow <= 0) {
      remainingInRow = gridWidth;
      currentRow = undefined;
    }
  }

  return count;
}

async function handleAutoLayout(args: any): Promise<ToolResult> {
  const form = requireForm(args.formId);

  const gridWidth = args.columns ?? DEFAULT_COLUMNS;
  if (gridWidth < 1 || gridWidth > DEFAULT_COLUMNS || !Number.isInteger(gridWidth)) {
    throw new Error(`columns must be an integer between 1 and ${DEFAULT_COLUMNS}`);
  }

  const strategy: Strategy = args.strategy ?? 'single-column';
  const validStrategies = ['single-column', 'two-column', 'compact'];
  if (!validStrategies.includes(strategy)) {
    throw new Error(`Invalid strategy: ${strategy}. Use one of: ${validStrategies.join(', ')}`);
  }

  let count: number;
  switch (strategy) {
    case 'single-column': {
      count = layoutSingleColumn(form.schema.components, gridWidth);
      break;
    }
    case 'two-column': {
      count = layoutTwoColumn(form.schema.components, gridWidth);
      break;
    }
    case 'compact': {
      count = layoutCompact(form.schema.components, gridWidth);
      break;
    }
  }

  bumpVersion(form, args.formId);

  return mutationResult(form, {
    formId: args.formId,
    strategy,
    gridWidth,
    componentsLaidOut: count,
    message: `Applied "${strategy}" layout to ${count} components`,
  });
}
