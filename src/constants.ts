/**
 * Centralised constants for form-js-mcp.
 */

/** Current form-js schema version. */
export const DEFAULT_SCHEMA_VERSION = 19;

/** Default grid column count (form-js uses a 16-column grid). */
export const DEFAULT_COLUMNS = 16;

/** Exporter metadata embedded in exported schemas. */
export const EXPORTER = { name: 'form-js-mcp', version: '1.0.0' } as const;

// ── Field type classifications ─────────────────────────────────────────────

/** Input field types (keyed — bind to process variables). */
export const INPUT_FIELD_TYPES = [
  'textfield',
  'textarea',
  'number',
  'datetime',
  'expression',
  'filepicker',
] as const;

/** Selection field types (keyed — bind to process variables). */
export const SELECTION_FIELD_TYPES = [
  'checkbox',
  'checklist',
  'radio',
  'select',
  'taglist',
] as const;

/** Presentation field types (non-keyed — display only). */
export const PRESENTATION_FIELD_TYPES = [
  'text',
  'html',
  'image',
  'table',
  'documentPreview',
  'spacer',
  'separator',
] as const;

/** Container field types (can have nested components). */
export const CONTAINER_FIELD_TYPES = ['group', 'dynamiclist', 'iframe'] as const;

/** Action field types. */
export const ACTION_FIELD_TYPES = ['button'] as const;

/** All keyed field types (fields that bind to a data variable via `key`). */
export const KEYED_FIELD_TYPES = [...INPUT_FIELD_TYPES, ...SELECTION_FIELD_TYPES] as const;

/** Field types that accept option values (values/valuesKey/valuesExpression). */
export const OPTIONS_FIELD_TYPES = ['select', 'radio', 'checklist', 'taglist'] as const;

/** All supported field types. */
export const SUPPORTED_FIELD_TYPES = [
  ...INPUT_FIELD_TYPES,
  ...SELECTION_FIELD_TYPES,
  ...PRESENTATION_FIELD_TYPES,
  ...CONTAINER_FIELD_TYPES,
  ...ACTION_FIELD_TYPES,
] as const;

/** Union type of all supported field type strings. */
export type FormFieldType = (typeof SUPPORTED_FIELD_TYPES)[number];
