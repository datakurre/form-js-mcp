/**
 * clone_form — Deep-clone a form with new IDs.
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent } from '../../types';
import { generateFormId, storeForm } from '../../form-manager';
import { validateArgs, requireForm, jsonResult, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'clone_form',
  description:
    'Deep-clone a form, generating new IDs for the form and all components. ' +
    'Returns the new formId.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: {
        type: 'string',
        description: 'The form to clone',
      },
      name: {
        type: 'string',
        description: 'Name for the cloned form (defaults to original name + " (copy)")',
      },
    },
    required: ['formId'],
  },
} as const;

function regenerateIds(components: FormComponent[]): FormComponent[] {
  return components.map((comp) => {
    const suffix = randomBytes(4).toString('hex');
    const newComp: FormComponent = {
      ...comp,
      id: comp.id ? `${comp.type}_${suffix}` : undefined,
    };
    if (newComp.components) {
      newComp.components = regenerateIds(newComp.components);
    }
    return newComp;
  });
}

export async function handleCloneForm(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId']);
  const original = requireForm(args.formId);

  const clonedSchema = JSON.parse(JSON.stringify(original.schema));
  clonedSchema.id = `Form_${randomBytes(4).toString('hex')}`;
  clonedSchema.components = regenerateIds(clonedSchema.components);

  const newName = args.name ?? (original.name ? `${original.name} (copy)` : undefined);
  const newFormId = generateFormId();
  storeForm(newFormId, { schema: clonedSchema, name: newName, version: 0 });

  return jsonResult({
    formId: newFormId,
    name: newName ?? null,
    componentCount: countComponents(clonedSchema.components),
    message: `Cloned form as ${newFormId}`,
  });
}
