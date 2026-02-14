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
    'Set the grid layout (columns) on a form component. ' +
    `The form uses a ${DEFAULT_COLUMNS}-column grid. ` +
    'Set columns to control the width of a component.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      columns: {
        type: 'number',
        description: `Column span (1-${DEFAULT_COLUMNS}, default ${DEFAULT_COLUMNS})`,
      },
    },
    required: ['formId', 'componentId', 'columns'],
  },
} as const;

export async function handleSetFormLayout(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId', 'columns']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const columns = Number(args.columns);
  if (columns < 1 || columns > DEFAULT_COLUMNS || !Number.isInteger(columns)) {
    throw new Error(`columns must be an integer between 1 and ${DEFAULT_COLUMNS}`);
  }

  const layout: FormLayout = comp.layout ?? {};
  layout.columns = columns;
  comp.layout = layout;
  bumpVersion(form, args.formId);

  return mutationResult(form, {
    componentId: args.componentId,
    layout: comp.layout,
    message: `Set layout on "${args.componentId}": columns = ${columns}`,
  });
}
