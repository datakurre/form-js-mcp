import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm } from './helpers';
import {
  validateArgs,
  requireForm,
  requireComponent,
  findComponentById,
  findComponentByKey,
  findParentComponents,
  bumpVersion,
  textResult,
  jsonResult,
  generateComponentId,
  isKeyedType,
  isSupportedType,
  collectAllKeys,
  collectAllIds,
  countComponents,
  collectValidationHints,
  mutationResult,
} from '../src/handlers/helpers';

describe('handler helpers', () => {
  beforeEach(() => {
    clearForms();
  });

  // ── validateArgs ───────────────────────────────────────────────────────

  describe('validateArgs', () => {
    test('throws when args is null', () => {
      expect(() => validateArgs(null, ['field'])).toThrow('Missing arguments');
    });

    test('throws when required field is undefined', () => {
      expect(() => validateArgs({}, ['formId'])).toThrow('Missing required argument: formId');
    });

    test('throws when required field is null', () => {
      expect(() => validateArgs({ formId: null }, ['formId'])).toThrow(
        'Missing required argument: formId'
      );
    });

    test('passes when all required fields present', () => {
      expect(() => validateArgs({ formId: 'f1', type: 'text' }, ['formId', 'type'])).not.toThrow();
    });
  });

  // ── requireForm ────────────────────────────────────────────────────────

  describe('requireForm', () => {
    test('returns form when it exists', () => {
      const { formId, form } = createForm('Test');
      const result = requireForm(formId);
      expect(result).toBe(form);
    });

    test('throws when form not found', () => {
      expect(() => requireForm('nonexistent')).toThrow('Form not found');
    });
  });

  // ── requireComponent ──────────────────────────────────────────────────

  describe('requireComponent', () => {
    test('returns component when it exists', () => {
      const { form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      const comp = requireComponent(form, 'a');
      expect(comp.type).toBe('textfield');
    });

    test('throws when component not found', () => {
      const { form } = createForm();
      expect(() => requireComponent(form, 'nonexistent')).toThrow('Component not found');
    });
  });

  // ── findComponentById ─────────────────────────────────────────────────

  describe('findComponentById', () => {
    test('finds top-level component', () => {
      const components = [{ type: 'textfield', id: 'a', key: 'name' }];
      expect(findComponentById(components, 'a')).toBeDefined();
    });

    test('finds nested component', () => {
      const components = [
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'textfield', id: 'inner', key: 'x' }],
        },
      ];
      expect(findComponentById(components, 'inner')).toBeDefined();
    });

    test('returns undefined for missing component', () => {
      expect(findComponentById([], 'nope')).toBeUndefined();
    });
  });

  // ── findComponentByKey ────────────────────────────────────────────────

  describe('findComponentByKey', () => {
    test('finds by key', () => {
      const components = [{ type: 'textfield', id: 'a', key: 'name' }];
      expect(findComponentByKey(components, 'name')).toBeDefined();
    });

    test('finds nested by key', () => {
      const components = [
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'textfield', id: 'a', key: 'nested' }],
        },
      ];
      expect(findComponentByKey(components, 'nested')).toBeDefined();
    });

    test('returns undefined for missing key', () => {
      expect(findComponentByKey([], 'nope')).toBeUndefined();
    });
  });

  // ── findParentComponents ──────────────────────────────────────────────

  describe('findParentComponents', () => {
    test('returns parent array for top-level', () => {
      const components = [{ type: 'textfield', id: 'a', key: 'name' }];
      const parent = findParentComponents(components, 'a');
      expect(parent).toBe(components);
    });

    test('returns parent array for nested', () => {
      const inner = [{ type: 'textfield', id: 'inner', key: 'x' }];
      const components = [{ type: 'group', id: 'g1', components: inner }];
      const parent = findParentComponents(components, 'inner');
      expect(parent).toBe(inner);
    });

    test('returns undefined for missing', () => {
      expect(findParentComponents([], 'nope')).toBeUndefined();
    });
  });

  // ── bumpVersion ───────────────────────────────────────────────────────

  describe('bumpVersion', () => {
    test('increments version from 0', () => {
      const { form } = createForm();
      form.version = 0;
      bumpVersion(form);
      expect(form.version).toBe(1);
    });

    test('increments from undefined', () => {
      const { form } = createForm();
      form.version = undefined;
      bumpVersion(form);
      expect(form.version).toBe(1);
    });
  });

  // ── textResult / jsonResult ───────────────────────────────────────────

  describe('result helpers', () => {
    test('textResult wraps text', () => {
      const result = textResult('hello');
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('hello');
    });

    test('jsonResult serializes object', () => {
      const result = jsonResult({ ok: true });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
    });
  });

  // ── generateComponentId ───────────────────────────────────────────────

  describe('generateComponentId', () => {
    test('includes type prefix', () => {
      const id = generateComponentId('textfield');
      expect(id).toMatch(/^Textfield_/);
    });

    test('includes cleaned label', () => {
      const id = generateComponentId('textfield', 'My Field!');
      expect(id).toMatch(/^Textfield_MyField_/);
    });

    test('handles empty label', () => {
      const id = generateComponentId('number', '');
      expect(id).toMatch(/^Number_/);
    });
  });

  // ── type checks ───────────────────────────────────────────────────────

  describe('type checks', () => {
    test('isKeyedType returns true for keyed', () => {
      expect(isKeyedType('textfield')).toBe(true);
      expect(isKeyedType('select')).toBe(true);
    });

    test('isKeyedType returns false for non-keyed', () => {
      expect(isKeyedType('text')).toBe(false);
      expect(isKeyedType('separator')).toBe(false);
    });

    test('isSupportedType returns true for supported', () => {
      expect(isSupportedType('textfield')).toBe(true);
      expect(isSupportedType('group')).toBe(true);
    });

    test('isSupportedType returns false for unknown', () => {
      expect(isSupportedType('fancywidget')).toBe(false);
    });
  });

  // ── collection helpers ────────────────────────────────────────────────

  describe('collection helpers', () => {
    test('collectAllKeys gathers keys recursively', () => {
      const components = [
        { type: 'textfield', id: 'a', key: 'name' },
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'number', id: 'b', key: 'age' }],
        },
      ];
      const keys = collectAllKeys(components);
      expect(keys).toContain('name');
      expect(keys).toContain('age');
    });

    test('collectAllIds gathers ids recursively', () => {
      const components = [
        { type: 'textfield', id: 'a', key: 'name' },
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'number', id: 'b', key: 'age' }],
        },
      ];
      const ids = collectAllIds(components);
      expect(ids).toContain('a');
      expect(ids).toContain('g1');
      expect(ids).toContain('b');
    });

    test('countComponents counts recursively', () => {
      const components = [
        { type: 'textfield', id: 'a' },
        {
          type: 'group',
          id: 'g1',
          components: [
            { type: 'textfield', id: 'b' },
            { type: 'textfield', id: 'c' },
          ],
        },
      ];
      expect(countComponents(components)).toBe(4);
    });
  });

  // ── validation hints ──────────────────────────────────────────────────

  describe('collectValidationHints', () => {
    test('returns all issues when hintLevel is full', () => {
      const { form } = createForm();
      form.hintLevel = 'full';
      form.schema.components = [{ type: 'textfield', id: 'a' }]; // missing key
      const hints = collectValidationHints(form);
      expect(hints.length).toBeGreaterThan(0);
    });

    test('returns empty when hintLevel is none', () => {
      const { form } = createForm();
      form.hintLevel = 'none';
      form.schema.components = [{ type: 'textfield', id: 'a' }];
      const hints = collectValidationHints(form);
      expect(hints).toHaveLength(0);
    });

    test('returns only errors when hintLevel is minimal', () => {
      const { form } = createForm();
      form.hintLevel = 'minimal';
      form.schema.components = [
        { type: 'textfield', id: 'a' },
        { type: 'fancywidget', id: 'b' },
      ];
      const hints = collectValidationHints(form);
      for (const h of hints) {
        expect(h.severity).toBe('error');
      }
    });

    test('returns all issues by default (hintLevel undefined)', () => {
      const { form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a' }];
      const hints = collectValidationHints(form);
      expect(hints.length).toBeGreaterThan(0);
    });
  });

  // ── mutationResult ────────────────────────────────────────────────────

  describe('mutationResult', () => {
    test('includes _hints when form has validation issues', () => {
      const { form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a' }]; // missing key
      const result = mutationResult(form, { ok: true });
      const data = JSON.parse(result.content[0].text);
      expect(data._hints).toBeDefined();
      expect(data._hints.length).toBeGreaterThan(0);
    });

    test('omits _hints when form is valid', () => {
      const { form } = createForm();
      form.schema.components = [];
      const result = mutationResult(form, { ok: true });
      const data = JSON.parse(result.content[0].text);
      expect(data._hints).toBeUndefined();
    });
  });
});
