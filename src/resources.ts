/**
 * MCP resource endpoints for form-js-mcp.
 *
 * Exposes form data as MCP resources so that AI assistants can
 * browse forms, schemas, validation issues, and variables without
 * needing to call tools.
 *
 * URI scheme:
 *   form://forms                       — list all in-memory forms
 *   form://form/{formId}/summary       — lightweight summary
 *   form://form/{formId}/schema        — current JSON schema
 *   form://form/{formId}/validation    — validation issues
 *   form://form/{formId}/variables     — input/output variables
 *   form://guides/form-field-reference — comprehensive field type reference
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getAllForms, getForm } from './form-manager';
import { validateFormSchema } from './validator';
import { countComponents } from './handlers/helpers';
import {
  SUPPORTED_FIELD_TYPES,
  INPUT_FIELD_TYPES,
  SELECTION_FIELD_TYPES,
  PRESENTATION_FIELD_TYPES,
  CONTAINER_FIELD_TYPES,
  ACTION_FIELD_TYPES,
  KEYED_FIELD_TYPES,
  OPTIONS_FIELD_TYPES,
} from './constants';
import { type FormComponent } from './types';

// ── Resource template definitions (P5.2) ───────────────────────────────────

export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'form://forms',
    name: 'All Forms',
    description: 'List all in-memory forms with summary information',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'form://form/{formId}/summary',
    name: 'Form Summary',
    description: 'Lightweight summary of a form (name, component count, types)',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'form://form/{formId}/schema',
    name: 'Form Schema',
    description: 'The full JSON schema of a form',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'form://form/{formId}/validation',
    name: 'Form Validation',
    description: 'Validation issues for a form (errors and warnings)',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'form://form/{formId}/variables',
    name: 'Form Variables',
    description: 'Input and output variables extracted from the form',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'form://guides/form-field-reference',
    name: 'Form Field Reference',
    description: 'Comprehensive reference of all supported form field types',
    mimeType: 'text/markdown',
  },
] as const;

// ── listResources (P5.3) ──────────────────────────────────────────────────

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** Return concrete resource URIs for all currently loaded forms. */
export function listResources(): ResourceDescriptor[] {
  const resources: ResourceDescriptor[] = [];
  const forms = getAllForms();

  // Static: list-all
  resources.push({
    uri: 'form://forms',
    name: 'All Forms',
    description: `${forms.size} form(s) in memory`,
    mimeType: 'application/json',
  });

  // Per-form resources
  for (const [formId, state] of forms) {
    const label = state.name ?? formId;
    resources.push(
      {
        uri: `form://form/${formId}/summary`,
        name: `${label} — Summary`,
        mimeType: 'application/json',
      },
      {
        uri: `form://form/${formId}/schema`,
        name: `${label} — Schema`,
        mimeType: 'application/json',
      },
      {
        uri: `form://form/${formId}/validation`,
        name: `${label} — Validation`,
        mimeType: 'application/json',
      },
      {
        uri: `form://form/${formId}/variables`,
        name: `${label} — Variables`,
        mimeType: 'application/json',
      }
    );
  }

  // Static guide
  resources.push({
    uri: 'form://guides/form-field-reference',
    name: 'Form Field Reference',
    description: 'Comprehensive field type reference with examples',
    mimeType: 'text/markdown',
  });

  return resources;
}

// ── readResource (P5.4) ───────────────────────────────────────────────────

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

/** Read a resource by URI. */
export function readResource(uri: string): ResourceContent {
  // form://forms
  if (uri === 'form://forms') {
    return readFormsList();
  }

  // form://guides/form-field-reference
  if (uri === 'form://guides/form-field-reference') {
    return readFieldReference();
  }

  // form://form/{formId}/{aspect}
  const match = /^form:\/\/form\/([^/]+)\/(summary|schema|validation|variables)$/.exec(uri);
  if (match) {
    const [, formId, aspect] = match;
    return readFormAspect(formId, aspect as 'summary' | 'schema' | 'validation' | 'variables');
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
}

// ── Internal readers ──────────────────────────────────────────────────────

function readFormsList(): ResourceContent {
  const forms = getAllForms();
  const list = [...forms.entries()].map(([formId, state]) => ({
    formId,
    name: state.name,
    componentCount: countComponents(state.schema.components),
    version: state.version ?? 0,
  }));
  return {
    uri: 'form://forms',
    mimeType: 'application/json',
    text: JSON.stringify({ count: list.length, forms: list }, null, 2),
  };
}

function readFormAspect(
  formId: string,
  aspect: 'summary' | 'schema' | 'validation' | 'variables'
): ResourceContent {
  const state = getForm(formId);
  if (!state) {
    throw new McpError(ErrorCode.InvalidRequest, `Form not found: ${formId}`);
  }

  switch (aspect) {
    case 'summary':
      return readSummary(formId, state);
    case 'schema':
      return readSchema(formId, state);
    case 'validation':
      return readValidation(formId, state);
    case 'variables':
      return readVariables(formId, state);
  }
}

function readSummary(
  formId: string,
  state: { schema: any; name?: string; version?: number }
): ResourceContent {
  const components = state.schema.components ?? [];
  const byType: Record<string, number> = {};
  const walkForSummary = (comps: FormComponent[]) => {
    for (const c of comps) {
      byType[c.type] = (byType[c.type] ?? 0) + 1;
      if (c.components) walkForSummary(c.components);
    }
  };
  walkForSummary(components);

  return {
    uri: `form://form/${formId}/summary`,
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        formId,
        name: state.name,
        totalComponents: countComponents(components),
        componentsByType: byType,
        version: state.version ?? 0,
      },
      null,
      2
    ),
  };
}

function readSchema(formId: string, state: { schema: any }): ResourceContent {
  return {
    uri: `form://form/${formId}/schema`,
    mimeType: 'application/json',
    text: JSON.stringify(state.schema, null, 2),
  };
}

function readValidation(formId: string, state: { schema: any }): ResourceContent {
  const result = validateFormSchema(state.schema);
  return {
    uri: `form://form/${formId}/validation`,
    mimeType: 'application/json',
    text: JSON.stringify(result, null, 2),
  };
}

function readVariables(formId: string, state: { schema: any }): ResourceContent {
  const inputKeys: string[] = [];
  const walk = (comps: FormComponent[]) => {
    for (const c of comps) {
      if (c.key && (KEYED_FIELD_TYPES as readonly string[]).includes(c.type)) {
        inputKeys.push(c.key);
      }
      if (c.components) walk(c.components);
    }
  };
  walk(state.schema.components ?? []);

  return {
    uri: `form://form/${formId}/variables`,
    mimeType: 'application/json',
    text: JSON.stringify({ formId, inputKeys, total: inputKeys.length }, null, 2),
  };
}

// ── Static guide (P5.5) ──────────────────────────────────────────────────

function readFieldReference(): ResourceContent {
  const lines: string[] = [
    '# Form Field Type Reference',
    '',
    'Comprehensive reference for all supported form-js field types.',
    '',
    '## Input Fields (keyed — bind to process variables)',
    '',
    ...INPUT_FIELD_TYPES.map((t) => `- **${t}** — ${fieldBrief(t)}`),
    '',
    '## Selection Fields (keyed — bind to process variables)',
    '',
    ...SELECTION_FIELD_TYPES.map((t) => `- **${t}** — ${fieldBrief(t)}`),
    '',
    '## Presentation Fields (non-keyed — display only)',
    '',
    ...PRESENTATION_FIELD_TYPES.map((t) => `- **${t}** — ${fieldBrief(t)}`),
    '',
    '## Container Fields',
    '',
    ...CONTAINER_FIELD_TYPES.map((t) => `- **${t}** — ${fieldBrief(t)}`),
    '',
    '## Action Fields',
    '',
    ...ACTION_FIELD_TYPES.map((t) => `- **${t}** — ${fieldBrief(t)}`),
    '',
    `## Summary`,
    '',
    `- **Total types:** ${SUPPORTED_FIELD_TYPES.length}`,
    `- **Keyed types:** ${KEYED_FIELD_TYPES.length} (${KEYED_FIELD_TYPES.join(', ')})`,
    `- **Options types:** ${OPTIONS_FIELD_TYPES.length} (${OPTIONS_FIELD_TYPES.join(', ')})`,
    '',
  ];

  return {
    uri: 'form://guides/form-field-reference',
    mimeType: 'text/markdown',
    text: lines.join('\n'),
  };
}

function fieldBrief(type: string): string {
  const briefs: Record<string, string> = {
    textfield: 'Single-line text input',
    textarea: 'Multi-line text input',
    number: 'Numeric input with optional min/max',
    datetime: 'Date and/or time picker',
    expression: 'Computed value via FEEL expression',
    filepicker: 'File upload input',
    checkbox: 'Boolean toggle (true/false)',
    checklist: 'Multi-select checkboxes from a list of options',
    radio: 'Single-select radio button group',
    select: 'Dropdown single-select',
    taglist: 'Multi-select tag input',
    text: 'Static text (Markdown supported)',
    html: 'Raw HTML content',
    image: 'Static image display',
    table: 'Data table display',
    documentPreview: 'Document preview component',
    spacer: 'Vertical spacing element',
    separator: 'Horizontal rule separator',
    group: 'Container that groups fields together',
    dynamiclist: 'Repeatable list of field groups',
    iframe: 'Embedded iframe content',
    button: 'Action button (submit, reset, etc.)',
  };
  return briefs[type] ?? 'Form field';
}
