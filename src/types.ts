/**
 * Shared interfaces used across the form-js-mcp server.
 */

// ── Hint level ─────────────────────────────────────────────────────────────

/**
 * Controls how much implicit feedback is included in tool responses.
 *
 * - `'full'`    — validation errors + warnings (default)
 * - `'minimal'` — validation errors only
 * - `'none'`    — no implicit feedback
 */
export type HintLevel = 'none' | 'minimal' | 'full';

// ── Form schema types ──────────────────────────────────────────────────────

/** Validation rules for a form component. */
export interface FormValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternErrorMessage?: string;
  validationType?: 'email' | 'phone';
  /** Custom error message shown when validation fails. */
  validationError?: string;
}

/** Conditional visibility for a form component. */
export interface FormConditional {
  /** FEEL expression; when truthy the field is hidden. */
  hide?: string;
}

/** Grid layout options for a form component. */
export interface FormLayout {
  /** Column span (1–16). */
  columns?: number;
  /** Row identifier — components sharing a row are placed side-by-side. */
  row?: string;
}

/** A single option value (for select, radio, checklist, taglist). */
export interface FormOptionValue {
  label: string;
  value: string;
}

/** An individual form component (field). */
export interface FormComponent {
  type: string;
  id?: string;
  key?: string;
  label?: string;
  description?: string;
  defaultValue?: any;
  disabled?: boolean;
  readonly?: boolean;
  validate?: FormValidation;
  conditional?: FormConditional;
  layout?: FormLayout;
  /** Static option values (select, radio, checklist, taglist). */
  values?: FormOptionValue[];
  /** Dynamic options from input data. */
  valuesKey?: string;
  /** FEEL expression for dynamic options. */
  valuesExpression?: string;
  /** Custom properties bag. */
  properties?: Record<string, any>;
  /** Nested components (group, dynamiclist, root). */
  components?: FormComponent[];
  /** Additional type-specific properties (text content, image source, etc.) */
  [key: string]: any;
}

/** Top-level form schema. */
export interface FormSchema {
  type: 'default';
  id?: string;
  schemaVersion?: number;
  exporter?: { name: string; version: string };
  executionPlatform?: string;
  executionPlatformVersion?: string;
  versionTag?: string;
  components: FormComponent[];
}

// ── Form state ─────────────────────────────────────────────────────────────

/** State for a single in-memory form. */
export interface FormState {
  schema: FormSchema;
  name?: string;
  /**
   * Controls implicit feedback verbosity on mutating operations.
   * - `'full'`    — validation errors + warnings (default)
   * - `'minimal'` — validation errors only
   * - `'none'`    — no implicit feedback
   */
  hintLevel?: HintLevel;
  /** Monotonically increasing version counter, bumped on each mutation. */
  version?: number;
}

/** Shape of the JSON returned by tool handlers that wrap results. */
export interface ToolResult {
  content: Array<{ type: string; text: string }>;
}
