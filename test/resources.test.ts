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
    test('has 2 templates', () => {
      expect(RESOURCE_TEMPLATES.length).toBe(2);
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
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain('form://forms');
      expect(uris).toContain('form://guides/form-field-reference');
    });

    test('returns only static resources even when forms exist', () => {
      createForm('Test');
      const resources = listResources();
      const uris = resources.map((r) => r.uri);
      expect(uris).toContain('form://forms');
      expect(uris).toContain('form://guides/form-field-reference');
      // No per-form resources
      expect(uris.every((u) => !u.includes('/summary'))).toBe(true);
      expect(uris.every((u) => !u.includes('/schema'))).toBe(true);
      expect(uris.every((u) => !u.includes('/validation'))).toBe(true);
      expect(uris.every((u) => !u.includes('/variables'))).toBe(true);
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

    test('throws for removed per-form resource URIs', () => {
      const { formId } = createForm('Test');
      expect(() => readResource(`form://form/${formId}/schema`)).toThrow('Unknown resource');
      expect(() => readResource(`form://form/${formId}/summary`)).toThrow('Unknown resource');
    });
  });
});
