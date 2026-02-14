import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from './helpers';
import {
  getForm,
  storeForm,
  deleteForm,
  getAllForms,
  generateFormId,
  clearForms as clearStore,
  createEmptySchema,
} from '../src/form-manager';

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

describe('form-manager store', () => {
  beforeEach(() => {
    clearStore();
  });

  test('generateFormId returns unique IDs', () => {
    const a = generateFormId();
    const b = generateFormId();
    expect(a).toMatch(/^form_/);
    expect(b).toMatch(/^form_/);
    expect(a).not.toBe(b);
  });

  test('createEmptySchema returns valid schema', () => {
    const schema = createEmptySchema('Test');
    expect(schema.type).toBe('default');
    expect(schema.components).toEqual([]);
    expect(schema.id).toMatch(/^Form_/);
    expect(schema.schemaVersion).toBeGreaterThan(0);
    expect(schema.exporter).toBeTruthy();
  });

  test('storeForm and getForm round-trip', () => {
    const id = generateFormId();
    const schema = createEmptySchema();
    storeForm(id, { schema, name: 'Test' });

    const retrieved = getForm(id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.name).toBe('Test');
    expect(retrieved!.schema.type).toBe('default');
  });

  test('getForm returns undefined for unknown ID', () => {
    expect(getForm('nonexistent')).toBeUndefined();
  });

  test('deleteForm removes a form', () => {
    const id = generateFormId();
    storeForm(id, { schema: createEmptySchema() });
    expect(getForm(id)).toBeTruthy();

    const deleted = deleteForm(id);
    expect(deleted).toBe(true);
    expect(getForm(id)).toBeUndefined();
  });

  test('deleteForm returns false for unknown ID', () => {
    expect(deleteForm('nonexistent')).toBe(false);
  });

  test('getAllForms returns all stored forms', () => {
    storeForm('a', { schema: createEmptySchema() });
    storeForm('b', { schema: createEmptySchema() });
    const all = getAllForms();
    expect(all.size).toBe(2);
    expect(all.has('a')).toBe(true);
    expect(all.has('b')).toBe(true);
  });

  test('clearForms removes all forms', () => {
    storeForm('a', { schema: createEmptySchema() });
    storeForm('b', { schema: createEmptySchema() });
    clearStore();
    expect(getAllForms().size).toBe(0);
  });
});
