/**
 * Shared test utilities for form-js-mcp tests.
 */

import { type ToolResult, type FormState } from '../src/types';
import { generateFormId, storeForm, clearForms, createEmptySchema } from '../src/form-manager';

/** Parse a ToolResult's first text content as JSON. */
export function parseResult(result: ToolResult): any {
  const text = result.content[0]?.text;
  if (!text) throw new Error('Empty tool result');
  return JSON.parse(text);
}

/** Create a form in the store and return its ID. */
export function createForm(name?: string): { formId: string; form: FormState } {
  const formId = generateFormId();
  const schema = createEmptySchema(name);
  const form: FormState = { schema, name, version: 0 };
  storeForm(formId, form);
  return { formId, form };
}

/** Re-export clearForms for test teardown. */
export { clearForms };
