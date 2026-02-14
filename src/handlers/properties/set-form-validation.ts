/**
 * set_form_validation — Configure validation rules on a component.
 */

import { type ToolResult, type FormValidation } from '../../types';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'set_form_validation',
  description:
    'Set validation rules on a form component. Supports required, minLength, ' +
    'maxLength, min, max, pattern, and custom validationError message.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      required: { type: 'boolean', description: 'Whether the field is required' },
      minLength: { type: 'number', description: 'Minimum string length' },
      maxLength: { type: 'number', description: 'Maximum string length' },
      min: { type: 'number', description: 'Minimum numeric value' },
      max: { type: 'number', description: 'Maximum numeric value' },
      pattern: { type: 'string', description: 'Regex pattern for validation' },
      validationError: { type: 'string', description: 'Custom error message' },
    },
    required: ['formId', 'componentId'],
  },
} as const;

export async function handleSetFormValidation(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const validate: FormValidation = comp.validate ?? {};
  const rules: string[] = [];

  if (args.required !== undefined) {
    validate.required = args.required;
    rules.push(`required=${args.required}`);
  }
  if (args.minLength !== undefined) {
    validate.minLength = args.minLength;
    rules.push(`minLength=${args.minLength}`);
  }
  if (args.maxLength !== undefined) {
    validate.maxLength = args.maxLength;
    rules.push(`maxLength=${args.maxLength}`);
  }
  if (args.min !== undefined) {
    validate.min = args.min;
    rules.push(`min=${args.min}`);
  }
  if (args.max !== undefined) {
    validate.max = args.max;
    rules.push(`max=${args.max}`);
  }
  if (args.pattern !== undefined) {
    validate.pattern = args.pattern;
    rules.push(`pattern=${args.pattern}`);
  }
  if (args.validationError !== undefined) {
    validate.validationError = args.validationError;
    rules.push(`validationError="${args.validationError}"`);
  }

  comp.validate = validate;
  bumpVersion(form);

  return mutationResult(form, {
    componentId: args.componentId,
    validate: comp.validate,
    rules,
    message: `Set ${rules.length} validation rules on "${args.componentId}"`,
  });
}
