import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from './helpers';

describe('test helpers', () => {
  beforeEach(() => {
    clearForms();
  });

  test('createForm returns formId and form state', () => {
    const { formId, form } = createForm('Test Form');
    expect(formId).toMatch(/^form_/);
    expect(form.schema.type).toBe('default');
    expect(form.schema.components).toEqual([]);
    expect(form.name).toBe('Test Form');
  });

  test('parseResult extracts JSON from tool result', () => {
    const result = { content: [{ type: 'text', text: '{"ok": true}' }] };
    expect(parseResult(result)).toEqual({ ok: true });
  });
});
