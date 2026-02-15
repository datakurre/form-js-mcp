/**
 * create_form — Create a new empty form, clone an existing one, or import a schema.
 *
 * Three modes:
 *   1. Empty form (default) — creates a blank form with optional platform settings
 *   2. Clone via `cloneFromId` — deep-clones an existing form with new IDs
 *   3. Import via `schema` — imports a JSON schema (string or object)
 */

import { randomBytes } from 'node:crypto';
import { type ToolResult, type FormComponent, type FormSchema } from '../../types';
import { generateFormId, storeForm, createEmptySchema } from '../../form-manager';
import { jsonResult, requireForm, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'create_form',
  description:
    'Create a new empty form, clone an existing one, or import a JSON schema. ' +
    'Returns the formId and initial schema. ' +
    'Use add_form_component to add fields afterwards. ' +
    'Pass cloneFromId to deep-clone an existing form with new IDs. ' +
    'Pass schema (JSON string or object) to import an existing form definition.',
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
      schema: {
        description:
          'Import a form schema as a JSON string or object. ' +
          'Must have a "components" array. Mutually exclusive with cloneFromId.',
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

// ── Import helpers ─────────────────────────────────────────────────────────

function parseSchema(raw: unknown): FormSchema {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON string for schema');
    }
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Schema must be a JSON object');
  }
  return raw as FormSchema;
}

function validateImportSchema(schema: FormSchema): void {
  if (!Array.isArray(schema.components)) {
    throw new Error('Schema must have a "components" array');
  }
  if (schema.type && schema.type !== 'default') {
    throw new Error(`Unsupported schema type: ${schema.type}`);
  }
}

// ── Handler modes ──────────────────────────────────────────────────────────

function handleClone(formId: string, args: any): ToolResult {
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

function handleImport(formId: string, args: any): ToolResult {
  const schema = parseSchema(args.schema);
  validateImportSchema(schema);
  schema.type = 'default';

  const name = args.name ?? schema.id ?? undefined;
  storeForm(formId, { schema, name, version: 0 });

  const componentCount = countComponents(schema.components);
  return jsonResult({
    formId,
    name: name ?? null,
    componentCount,
    message: `Imported form with ${componentCount} component(s)`,
  });
}

function handleEmpty(formId: string, args: any): ToolResult {
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

export async function handleCreateForm(args: any): Promise<ToolResult> {
  const formId = generateFormId();

  if (args?.cloneFromId) return handleClone(formId, args);
  if (args?.schema !== undefined) return handleImport(formId, args);
  return handleEmpty(formId, args);
}
