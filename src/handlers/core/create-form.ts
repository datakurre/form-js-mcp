/**
 * create_form — Create a new empty form, or clone an existing one.
 *
 * When `cloneFromId` is provided, deep-clones the source form with new IDs
 * for the form and all components — replacing the former `clone_form` tool.
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent } from '../../types';
import { generateFormId, storeForm, createEmptySchema } from '../../form-manager';
import { jsonResult, requireForm, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'create_form',
  description:
    'Create a new empty form, or clone an existing one. ' +
    'Returns the formId and initial schema. ' +
    'Use add_form_component to add fields afterwards. ' +
    'Pass cloneFromId to deep-clone an existing form with new IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Human-readable name for the form (e.g. "Invoice Form")',
      },
      executionPlatform: {
        type: 'string',
        enum: ['Camunda Cloud', 'Camunda Platform'],
        description: 'Target execution platform',
      },
      executionPlatformVersion: {
        type: 'string',
        description: 'Target platform version (e.g. "8.8.0")',
      },
      cloneFromId: {
        type: 'string',
        description:
          'Clone an existing form by ID. Deep-copies the schema with new IDs for the form and all components. ' +
          'Name defaults to "<original> (copy)" if not provided.',
      },
    },
  },
} as const;

// ── Clone helpers (ported from clone_form) ─────────────────────────────────

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

export async function handleCreateForm(args: any): Promise<ToolResult> {
  const formId = generateFormId();

  // ── Clone mode ─────────────────────────────────────────────────────────
  if (args?.cloneFromId) {
    const original = requireForm(args.cloneFromId);
    const clonedSchema = JSON.parse(JSON.stringify(original.schema));
    clonedSchema.id = `Form_${randomBytes(4).toString('hex')}`;
    clonedSchema.components = regenerateIds(clonedSchema.components);

    const newName = args.name ?? (original.name ? `${original.name} (copy)` : undefined);
    storeForm(formId, { schema: clonedSchema, name: newName, version: 0 });

    return jsonResult({
      formId,
      name: newName ?? null,
      componentCount: countComponents(clonedSchema.components),
      message: `Cloned form as ${formId}`,
    });
  }

  // ── Normal create mode ─────────────────────────────────────────────────
  const schema = createEmptySchema(args?.name);

  if (args?.executionPlatform) {
    schema.executionPlatform = args.executionPlatform;
  }
  if (args?.executionPlatformVersion) {
    schema.executionPlatformVersion = args.executionPlatformVersion;
  }

  storeForm(formId, { schema, name: args?.name, version: 0 });

  return jsonResult({
    formId,
    name: args?.name ?? null,
    schema,
  });
}
