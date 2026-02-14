import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms } from '../src/form-manager';
import { listResources, readResource, RESOURCE_TEMPLATES } from '../src/resources';
import { createForm } from './helpers';

describe('resources', () => {
  beforeEach(() => {
    clearForms();
  });

  // ── Template definitions ─────────────────────────────────────────────────

  describe('resource templates', () => {
    test('has at least 5 templates', () => {
      expect(RESOURCE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    test('each template has uriTemplate, name, and description', () => {
      for (const tpl of RESOURCE_TEMPLATES) {
        expect(tpl.uriTemplate).toBeTruthy();
        expect(tpl.name).toBeTruthy();
        expect(tpl.description).toBeTruthy();
      }
    });
  });

  // ── listResources ────────────────────────────────────────────────────────

  describe('listResources', () => {
    test('returns static resources when no forms exist', () => {
      const resources = listResources();
      // Should have at least: form://forms and form://guides/form-field-reference
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain('form://forms');
      expect(uris).toContain('form://guides/form-field-reference');
    });

    test('returns per-form resources when forms exist', () => {
      const { formId } = createForm('Test');
      const resources = listResources();
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain(`form://form/${formId}/summary`);
      expect(uris).toContain(`form://form/${formId}/schema`);
      expect(uris).toContain(`form://form/${formId}/validation`);
      expect(uris).toContain(`form://form/${formId}/variables`);
    });
  });

  // ── readResource ─────────────────────────────────────────────────────────

  describe('readResource', () => {
    test('reads form://forms', () => {
      createForm('A');
      createForm('B');
      const content = readResource('form://forms');
      expect(content.mimeType).toBe('application/json');
      const data = JSON.parse(content.text);
      expect(data.count).toBe(2);
      expect(data.forms).toHaveLength(2);
    });

    test('reads form summary', () => {
      const { formId, form } = createForm('Test');
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
      ];
      const content = readResource(`form://form/${formId}/summary`);
      const data = JSON.parse(content.text);
      expect(data.name).toBe('Test');
      expect(data.totalComponents).toBe(2);
      expect(data.componentsByType.textfield).toBe(1);
    });

    test('reads form schema', () => {
      const { formId } = createForm('Test');
      const content = readResource(`form://form/${formId}/schema`);
      const schema = JSON.parse(content.text);
      expect(schema.type).toBe('default');
      expect(schema.components).toEqual([]);
    });

    test('reads form validation', () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'textfield', id: 'b', key: 'name' }, // duplicate key
      ];
      const content = readResource(`form://form/${formId}/validation`);
      const data = JSON.parse(content.text);
      expect(data.valid).toBe(false);
      expect(data.issues.length).toBeGreaterThan(0);
    });

    test('reads form variables', () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'text', id: 'b' },
      ];
      const content = readResource(`form://form/${formId}/variables`);
      const data = JSON.parse(content.text);
      expect(data.inputKeys).toContain('name');
      expect(data.total).toBe(1);
    });

    test('reads form field reference guide', () => {
      const content = readResource('form://guides/form-field-reference');
      expect(content.mimeType).toBe('text/markdown');
      expect(content.text).toContain('textfield');
      expect(content.text).toContain('select');
      expect(content.text).toContain('group');
    });

    test('throws for unknown URI', () => {
      expect(() => readResource('form://unknown')).toThrow('Unknown resource');
    });

    test('throws for unknown form', () => {
      expect(() => readResource('form://form/nonexistent/schema')).toThrow('not found');
    });
  });
});
