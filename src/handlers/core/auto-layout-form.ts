/**
 * auto_layout_form — Auto-assign grid layout to form components.
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent } from '../../types';
import { DEFAULT_COLUMNS, PRESENTATION_FIELD_TYPES } from '../../constants';
import { validateArgs, requireForm, mutationResult, bumpVersion } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'auto_layout_form',
  description:
    'Auto-assign layout.columns and layout.row values to achieve a clean grid layout. ' +
    `The form uses a ${DEFAULT_COLUMNS}-column grid. ` +
    'Strategies: "single-column" (full width), "two-column" (side-by-side pairs), "compact" (auto-size by type).',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      columns: {
        type: 'number',
        description: `Grid width (default: ${DEFAULT_COLUMNS})`,
      },
      strategy: {
        type: 'string',
        enum: ['single-column', 'two-column', 'compact'],
        description: 'Layout strategy (default: "single-column")',
      },
    },
    required: ['formId'],
  },
} as const;

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

export async function handleAutoLayoutForm(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
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
