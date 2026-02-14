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
    'Set options on select, radio, checklist, or taglist components. ' +
    'Supports static options (label/value pairs), dynamic options from input data (valuesKey), ' +
    'or FEEL expression-based options (valuesExpression). Only one source can be active at a time.',
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
        description: 'Array of { label, value } static option objects',
      },
      valuesKey: {
        type: 'string',
        description:
          'Input data key containing dynamic options (array of { label, value } objects). ' +
          'Mutually exclusive with options and valuesExpression.',
      },
      valuesExpression: {
        type: 'string',
        description:
          'FEEL expression that resolves to an options list. ' +
          'Mutually exclusive with options and valuesKey.',
      },
    },
    required: ['formId', 'componentId'],
  },
} as const;

export async function handleSetFormOptions(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  if (!(OPTIONS_FIELD_TYPES as readonly string[]).includes(comp.type)) {
    throw new Error(
      `Component type "${comp.type}" does not support options. ` +
        `Use one of: ${OPTIONS_FIELD_TYPES.join(', ')}`
    );
  }

  // Count how many option sources are provided
  const sources = [args.options, args.valuesKey, args.valuesExpression].filter(
    (s) => s !== undefined && s !== null
  );
  if (sources.length === 0) {
    throw new Error('Provide one of: options, valuesKey, or valuesExpression');
  }
  if (sources.length > 1) {
    throw new Error('Only one of options, valuesKey, or valuesExpression can be set at a time');
  }

  // Static options
  if (args.options !== undefined) {
    const options: FormOptionValue[] = args.options;
    if (!Array.isArray(options)) throw new Error('"options" must be an array');

    for (const opt of options) {
      if (!opt.label || opt.value === undefined) {
        throw new Error('Each option must have a label and value');
      }
    }

    comp.values = options;
    comp.valuesKey = undefined;
    comp.valuesExpression = undefined;
    bumpVersion(form, args.formId);

    return mutationResult(form, {
      componentId: args.componentId,
      source: 'static',
      values: comp.values,
      count: options.length,
      message: `Set ${options.length} static options on "${args.componentId}"`,
    });
  }

  // Dynamic options from input data key
  if (args.valuesKey !== undefined) {
    comp.valuesKey = args.valuesKey;
    comp.values = undefined;
    comp.valuesExpression = undefined;
    bumpVersion(form, args.formId);

    return mutationResult(form, {
      componentId: args.componentId,
      source: 'valuesKey',
      valuesKey: comp.valuesKey,
      message: `Set dynamic options (valuesKey="${args.valuesKey}") on "${args.componentId}"`,
    });
  }

  // Dynamic options from FEEL expression
  comp.valuesExpression = args.valuesExpression;
  comp.values = undefined;
  comp.valuesKey = undefined;
  bumpVersion(form, args.formId);

  return mutationResult(form, {
    componentId: args.componentId,
    source: 'valuesExpression',
    valuesExpression: comp.valuesExpression,
    message: `Set dynamic options (valuesExpression) on "${args.componentId}"`,
  });
}
