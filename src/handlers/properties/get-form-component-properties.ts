/**
 * get_form_component_properties — Read all properties of a component.
 */

import { type ToolResult } from '../../types';
import { validateArgs, requireForm, requireComponent, jsonResult } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'get_form_component_properties',
  description: 'Get all properties of a specific form component.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
    },
    required: ['formId', 'componentId'],
  },
} as const;

export async function handleGetFormComponentProperties(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  // Return a copy without the nested components array for readability
  const { components: _children, ...properties } = comp;

  return jsonResult({
    componentId: args.componentId,
    properties,
    hasChildren: !!_children?.length,
    childCount: _children?.length ?? 0,
  });
}
