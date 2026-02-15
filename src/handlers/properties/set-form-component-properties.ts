/**
 * set_form_component_properties — Update properties on a component.
 *
 * This is the single tool for setting any component property, including:
 * - Generic properties (label, description, key, etc.)
 * - Type changes (via `type`) — compatible properties are preserved, incompatible ones removed
 * - Validation rules (via the `validate` object)
 * - Conditional visibility (via `conditional.hide`)
 * - Grid layout (via `layout.columns` / `layout.row`)
 * - Options for select/radio/checklist/taglist (via `values`, `valuesKey`, or `valuesExpression`)
 */

import {
  type ToolResult,
  type FormValidation,
  type FormConditional,
  type FormLayout,
  type FormOptionValue,
  type FormState,
} from '../../types';
import {
  OPTIONS_FIELD_TYPES,
  KEYED_FIELD_TYPES,
  CONTAINER_FIELD_TYPES,
  DEFAULT_COLUMNS,
} from '../../constants';
import {
  validateArgs,
  requireForm,
  requireComponent,
  mutationResult,
  bumpVersion,
  isSupportedType,
  collectAllKeys,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'set_form_component_properties',
  description:
    'Set or update properties on a form component. Pass a properties object ' +
    'with key/value pairs to set. Set a value to null to remove a property. ' +
    'Setting `type` changes the component type while preserving compatible properties ' +
    '(e.g. textfield → textarea keeps key, label, validate; incompatible properties are removed). ' +
    'Supports nested objects for validate (e.g. { validate: { required: true, minLength: 2 } }), ' +
    'conditional (e.g. { conditional: { hide: "=x > 1" } } or null to clear), ' +
    `layout (e.g. { layout: { columns: 8, row: "Row_1" } }, ${DEFAULT_COLUMNS}-column grid), ` +
    'and options for select/radio/checklist/taglist via values (static array of { label, value }), ' +
    'valuesKey (input data key), or valuesExpression (FEEL expression) — only one options source at a time.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID' },
      properties: {
        type: 'object',
        description:
          'Key/value pairs to set (null to delete a property). ' +
          'Special handling for: type (triggers type change with compatible-property preservation), ' +
          'validate (merged with existing rules), ' +
          'conditional (object with hide expression, or null to clear), ' +
          'layout (object with columns 1-16 and/or row identifier), ' +
          'values/valuesKey/valuesExpression (options — mutually exclusive, setting one clears the others).',
      },
    },
    required: ['formId', 'componentId', 'properties'],
  },
} as const;

const READ_ONLY_PROPS = new Set(['id', 'components']);

// ── Specialised property handlers ──────────────────────────────────────────

/**
 * Merge validation rules into the component's existing `validate` object.
 */
function applyValidation(
  comp: Record<string, any>,
  validate: Record<string, unknown>,
  updated: string[]
): void {
  const existing: FormValidation = comp.validate ?? {};

  const VALID_KEYS = [
    'required',
    'minLength',
    'maxLength',
    'min',
    'max',
    'pattern',
    'validationError',
  ];
  for (const key of VALID_KEYS) {
    if (validate[key] !== undefined) {
      (existing as any)[key] = validate[key];
    }
  }

  comp.validate = existing;
  updated.push('validate');
}

/**
 * Set or clear conditional visibility.
 */
function applyConditional(
  comp: Record<string, any>,
  conditional: FormConditional | null,
  updated: string[],
  removed: string[]
): void {
  if (conditional === null || !conditional.hide) {
    delete comp.conditional;
    removed.push('conditional');
  } else {
    comp.conditional = { hide: conditional.hide };
    updated.push('conditional');
  }
}

/**
 * Set grid layout (columns / row).
 */
function applyLayout(
  comp: Record<string, any>,
  layout: Record<string, unknown>,
  updated: string[]
): void {
  const existing: FormLayout = comp.layout ?? {};

  if (layout.columns !== undefined) {
    const columns = Number(layout.columns);
    if (columns < 1 || columns > DEFAULT_COLUMNS || !Number.isInteger(columns)) {
      throw new Error(`layout.columns must be an integer between 1 and ${DEFAULT_COLUMNS}`);
    }
    existing.columns = columns;
  }

  if (layout.row !== undefined) {
    if (layout.row === '' || layout.row === null) {
      delete existing.row;
    } else {
      existing.row = layout.row as string;
    }
  }

  comp.layout = existing;
  updated.push('layout');
}

/**
 * Set options source on a select/radio/checklist/taglist.
 * Enforces mutual exclusivity between values, valuesKey, and valuesExpression.
 */
function applyOptionsSource(
  comp: Record<string, any>,
  props: Record<string, unknown>,
  updated: string[]
): void {
  if (!(OPTIONS_FIELD_TYPES as readonly string[]).includes(comp.type)) {
    throw new Error(
      `Component type "${comp.type}" does not support options. ` +
        `Use one of: ${OPTIONS_FIELD_TYPES.join(', ')}`
    );
  }

  const sources = ['values', 'valuesKey', 'valuesExpression'].filter(
    (k) => props[k] !== undefined && props[k] !== null
  );
  if (sources.length > 1) {
    throw new Error('Only one of values, valuesKey, or valuesExpression can be set at a time');
  }

  if (props.values !== undefined) {
    const options = props.values as FormOptionValue[];
    if (!Array.isArray(options)) throw new Error('"values" must be an array');
    for (const opt of options) {
      if (!opt.label || opt.value === undefined) {
        throw new Error('Each option in values must have a label and value');
      }
    }
    comp.values = options;
    comp.valuesKey = undefined;
    comp.valuesExpression = undefined;
    updated.push('values');
  }

  if (props.valuesKey !== undefined) {
    comp.valuesKey = props.valuesKey;
    comp.values = undefined;
    comp.valuesExpression = undefined;
    updated.push('valuesKey');
  }

  if (props.valuesExpression !== undefined) {
    comp.valuesExpression = props.valuesExpression;
    comp.values = undefined;
    comp.valuesKey = undefined;
    updated.push('valuesExpression');
  }
}

// ── Type-change logic (ported from replace_form_component) ─────────────────

/**
 * Properties that are universally compatible across all field types.
 */
const UNIVERSAL_PROPS = new Set([
  'id',
  'type',
  'label',
  'description',
  'conditional',
  'layout',
  'properties',
]);

/** Properties specific to keyed (input/selection) types. */
const KEYED_PROPS = new Set(['key', 'defaultValue', 'disabled', 'readonly', 'validate']);

/** Properties specific to option-based types (select, radio, checklist, taglist). */
const OPTIONS_PROPS = new Set(['values', 'valuesKey', 'valuesExpression']);

/** Properties specific to container types (group, dynamiclist). */
const CONTAINER_PROPS = new Set(['components']);

function isKeyed(type: string): boolean {
  return (KEYED_FIELD_TYPES as readonly string[]).includes(type);
}

function isOptions(type: string): boolean {
  return (OPTIONS_FIELD_TYPES as readonly string[]).includes(type);
}

function isContainer(type: string): boolean {
  return (CONTAINER_FIELD_TYPES as readonly string[]).includes(type);
}

/**
 * Change a component's type while preserving compatible properties.
 */
function applyTypeChange(
  comp: Record<string, any>,
  newType: string,
  form: FormState,
  updated: string[],
  removed: string[]
): void {
  if (!isSupportedType(newType)) {
    throw new Error(`Unsupported field type: ${newType}`);
  }
  if (comp.type === newType) {
    throw new Error(`Component "${comp.id}" is already type "${newType}"`);
  }

  // Determine which properties to keep based on the new type
  const allKeys = Object.keys(comp).filter((k) => k !== 'type');

  for (const key of allKeys) {
    let keep = false;
    if (UNIVERSAL_PROPS.has(key)) {
      keep = true;
    } else if (KEYED_PROPS.has(key)) {
      keep = isKeyed(newType);
    } else if (OPTIONS_PROPS.has(key)) {
      keep = isOptions(newType);
    } else if (CONTAINER_PROPS.has(key)) {
      keep = isContainer(newType);
    }

    if (keep) {
      updated.push(key);
    } else {
      removed.push(key);
      delete comp[key];
    }
  }

  comp.type = newType;
  updated.push('type');

  // Auto-generate key when changing to a keyed type that has no key
  if (isKeyed(newType) && !comp.key) {
    const baseKey = (comp.label ?? newType).replaceAll(/[^\w]/g, '').toLowerCase() || newType;
    const existingKeys = new Set(collectAllKeys(form.schema.components));
    let candidateKey = baseKey;
    let counter = 1;
    while (existingKeys.has(candidateKey)) {
      candidateKey = `${baseKey}${counter++}`;
    }
    comp.key = candidateKey;
    updated.push('key (auto-generated)');
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

/** Apply a single property entry, dispatching to specialised handlers. */
function applySingleProperty(
  comp: Record<string, any>,
  key: string,
  value: unknown,
  hasOptionsProp: boolean,
  updated: string[],
  removed: string[]
): void {
  if (READ_ONLY_PROPS.has(key)) {
    throw new Error(`Cannot modify read-only property "${key}"`);
  }

  // Skip already-handled properties
  if (key === 'type') return;
  if (['values', 'valuesKey', 'valuesExpression'].includes(key) && hasOptionsProp) return;

  // Specialised handling for nested objects
  if (key === 'validate' && value !== null && typeof value === 'object') {
    applyValidation(comp, value as Record<string, unknown>, updated);
    return;
  }
  if (key === 'conditional') {
    applyConditional(comp, value as FormConditional | null, updated, removed);
    return;
  }
  if (key === 'layout' && value !== null && typeof value === 'object') {
    applyLayout(comp, value as Record<string, unknown>, updated);
    return;
  }

  // Generic property handling
  if (value === null) {
    delete comp[key];
    removed.push(key);
  } else {
    comp[key] = value;
    updated.push(key);
  }
}

export async function handleSetFormComponentProperties(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId', 'properties']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);

  const props: Record<string, unknown> = args.properties;
  const updated: string[] = [];
  const removed: string[] = [];

  // Handle type change first (before other properties, since it may remove properties)
  if (props.type !== undefined && props.type !== null) {
    applyTypeChange(comp as Record<string, any>, props.type as string, form, updated, removed);
  }

  // Check for options-source properties to handle them atomically
  const hasOptionsProp = ['values', 'valuesKey', 'valuesExpression'].some(
    (k) => props[k] !== undefined
  );
  if (hasOptionsProp) {
    applyOptionsSource(comp as Record<string, any>, props, updated);
  }

  for (const [key, value] of Object.entries(props)) {
    applySingleProperty(comp as Record<string, any>, key, value, hasOptionsProp, updated, removed);
  }

  bumpVersion(form, args.formId);

  return mutationResult(form, {
    componentId: args.componentId,
    updated,
    removed,
    message: `Updated ${updated.length} and removed ${removed.length} properties`,
  });
}
