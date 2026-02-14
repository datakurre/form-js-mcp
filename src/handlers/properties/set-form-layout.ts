/**
 * set_form_layout — Set layout (columns) on a component.
 */

import { type ToolResult, type FormLayout } from '../../types';
import { DEFAULT_COLUMNS } from '../../constants';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'set_form_layout',
  description:
    'Set the grid layout on a form component. ' +
    `The form uses a ${DEFAULT_COLUMNS}-column grid. ` +
    'Set columns to control width, and row to place components side-by-side. ' +
    'Components sharing the same row identifier are rendered on the same line.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      columns: {
        type: 'number',
        description: `Column span (1-${DEFAULT_COLUMNS}, default ${DEFAULT_COLUMNS})`,
      },
      row: {
        type: 'string',
        description:
          'Row identifier — components sharing the same row are placed side-by-side. ' +
          'Pass empty string to clear the row assignment.',
      },
    },
    required: ['formId', 'componentId'],
  },
} as const;

export async function handleSetFormLayout(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  if (args.columns === undefined && args.row === undefined) {
    throw new Error('At least one of columns or row must be provided');
  }

  const layout: FormLayout = comp.layout ?? {};
  const changes: string[] = [];

  if (args.columns !== undefined) {
    const columns = Number(args.columns);
    if (columns < 1 || columns > DEFAULT_COLUMNS || !Number.isInteger(columns)) {
      throw new Error(`columns must be an integer between 1 and ${DEFAULT_COLUMNS}`);
    }
    layout.columns = columns;
    changes.push(`columns = ${columns}`);
  }

  if (args.row !== undefined) {
    if (args.row === '' || args.row === null) {
      delete layout.row;
      changes.push('row cleared');
    } else {
      layout.row = args.row;
      changes.push(`row = "${args.row}"`);
    }
  }

  comp.layout = layout;
  bumpVersion(form, args.formId);

  return mutationResult(form, {
    componentId: args.componentId,
    layout: comp.layout,
    message: `Set layout on "${args.componentId}": ${changes.join(', ')}`,
  });
}
