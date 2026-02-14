/**
 * set_form_conditional — Set conditional visibility on a component.
 */

import { type ToolResult, type FormConditional } from '../../types';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'set_form_conditional',
  description:
    'Set conditional visibility on a component using a FEEL expression. ' +
    'The component is shown only when the condition evaluates to true.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      hide: {
        type: 'string',
        description: 'FEEL expression: when true, the component is hidden',
      },
    },
    required: ['formId', 'componentId', 'hide'],
  },
} as const;

export async function handleSetFormConditional(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId', 'hide']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const conditional: FormConditional = { hide: args.hide };
  comp.conditional = conditional;
  bumpVersion(form, args.formId);

  return mutationResult(form, {
    componentId: args.componentId,
    conditional,
    message: `Set conditional on "${args.componentId}": hide = ${args.hide}`,
  });
}
