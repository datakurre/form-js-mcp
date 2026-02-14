/**
 * set_form_component_properties — Update properties on a component.
 */

import { type ToolResult } from '../../types';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'set_form_component_properties',
  description:
    'Set or update properties on a form component. Pass a properties object ' +
    'with key/value pairs to set. Set a value to null to remove a property.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      properties: {
        type: 'object',
        description: 'Key/value pairs to set (null to delete a property)',
      },
    },
    required: ['formId', 'componentId', 'properties'],
  },
} as const;

const READ_ONLY_PROPS = new Set(['id', 'type', 'components']);

export async function handleSetFormComponentProperties(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId', 'properties']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const props: Record<string, unknown> = args.properties;
  const updated: string[] = [];
  const removed: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (READ_ONLY_PROPS.has(key)) {
      throw new Error(`Cannot modify read-only property "${key}"`);
    }
    if (value === null) {
      delete (comp as Record<string, unknown>)[key];
      removed.push(key);
    } else {
      (comp as Record<string, unknown>)[key] = value;
      updated.push(key);
    }
  }

  bumpVersion(form);

  return mutationResult(form, {
    componentId: args.componentId,
    updated,
    removed,
    message: `Updated ${updated.length} and removed ${removed.length} properties`,
  });
}
