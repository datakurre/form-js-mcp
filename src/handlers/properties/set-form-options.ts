/**
 * set_form_options — Set static options on a select/radio/checklist/taglist component.
 */

import { type ToolResult, type FormOptionValue } from '../../types';
import { OPTIONS_FIELD_TYPES } from '../../constants';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'set_form_options',
  description:
    'Set the static options (values list) on select, radio, checklist, or taglist components. ' +
    'Each option has a label and value.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['label', 'value'],
        },
        description: 'Array of { label, value } option objects',
      },
    },
    required: ['formId', 'componentId', 'options'],
  },
} as const;

export async function handleSetFormOptions(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId', 'options']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  if (!(OPTIONS_FIELD_TYPES as readonly string[]).includes(comp.type)) {
    throw new Error(
      `Component type "${comp.type}" does not support options. ` +
        `Use one of: ${OPTIONS_FIELD_TYPES.join(', ')}`
    );
  }

  const options: FormOptionValue[] = args.options;
  if (!Array.isArray(options)) throw new Error('"options" must be an array');

  for (const opt of options) {
    if (!opt.label || opt.value === undefined) {
      throw new Error('Each option must have a label and value');
    }
  }

  comp.values = options;
  comp.valuesExpression = undefined; // Remove dynamic expression if present
  bumpVersion(form, args.formId);

  return mutationResult(form, {
    componentId: args.componentId,
    values: comp.values,
    count: options.length,
    message: `Set ${options.length} options on "${args.componentId}"`,
  });
}
