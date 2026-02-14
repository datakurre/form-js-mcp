import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { handleGetFormComponentProperties } from '../../src/handlers/properties/get-form-component-properties';
import { handleSetFormComponentProperties } from '../../src/handlers/properties/set-form-component-properties';
import { handleSetFormValidation } from '../../src/handlers/properties/set-form-validation';
import { handleSetFormConditional } from '../../src/handlers/properties/set-form-conditional';
import { handleSetFormLayout } from '../../src/handlers/properties/set-form-layout';
import { handleSetFormOptions } from '../../src/handlers/properties/set-form-options';

describe('property handlers', () => {
  beforeEach(() => {
    clearForms();
  });

  // ── get_form_component_properties ──────────────────────────────────────

  describe('get_form_component_properties', () => {
    test('returns component properties', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'Name', description: 'Enter name' },
      ];
      const result = parseResult(
        await handleGetFormComponentProperties({ formId, componentId: 'a' })
      );
      expect(result.properties.key).toBe('name');
      expect(result.properties.label).toBe('Name');
      expect(result.properties.description).toBe('Enter name');
    });

    test('omits nested components array', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'group',
          id: 'g1',
          label: 'Group',
          components: [{ type: 'text', id: 'inner' }],
        },
      ];
      const result = parseResult(
        await handleGetFormComponentProperties({ formId, componentId: 'g1' })
      );
      expect(result.properties).not.toHaveProperty('components');
      expect(result.hasChildren).toBe(true);
      expect(result.childCount).toBe(1);
    });
  });

  // ── set_form_component_properties ──────────────────────────────────────

  describe('set_form_component_properties', () => {
    test('updates properties', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      const result = parseResult(
        await handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { label: 'Full Name', description: 'Your full name' },
        })
      );
      expect(result.updated).toContain('label');
      expect(result.updated).toContain('description');
      expect(form.schema.components[0].label).toBe('Full Name');
    });

    test('removes properties set to null', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'Name', description: 'Old' },
      ];
      const result = parseResult(
        await handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { description: null },
        })
      );
      expect(result.removed).toContain('description');
      expect(form.schema.components[0].description).toBeUndefined();
    });

    test('rejects read-only properties', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { id: 'new_id' },
        })
      ).rejects.toThrow('read-only');
    });
  });

  // ── set_form_validation ────────────────────────────────────────────────

  describe('set_form_validation', () => {
    test('sets validation rules', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      const result = parseResult(
        await handleSetFormValidation({
          formId,
          componentId: 'a',
          required: true,
          minLength: 2,
          maxLength: 100,
        })
      );
      expect(result.validate.required).toBe(true);
      expect(result.validate.minLength).toBe(2);
      expect(result.validate.maxLength).toBe(100);
      expect(result.rules).toHaveLength(3);
    });
  });

  // ── set_form_conditional ───────────────────────────────────────────────

  describe('set_form_conditional', () => {
    test('sets conditional hide expression', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      const result = parseResult(
        await handleSetFormConditional({
          formId,
          componentId: 'a',
          hide: '=showName = false',
        })
      );
      expect(result.conditional.hide).toBe('=showName = false');
    });
  });

  // ── set_form_layout ────────────────────────────────────────────────────

  describe('set_form_layout', () => {
    test('sets column width', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      const result = parseResult(
        await handleSetFormLayout({ formId, componentId: 'a', columns: 8 })
      );
      expect(result.layout.columns).toBe(8);
    });

    test('rejects out-of-range columns', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(handleSetFormLayout({ formId, componentId: 'a', columns: 0 })).rejects.toThrow(
        'columns'
      );
      await expect(handleSetFormLayout({ formId, componentId: 'a', columns: 17 })).rejects.toThrow(
        'columns'
      );
    });
  });

  // ── set_form_options ───────────────────────────────────────────────────

  describe('set_form_options', () => {
    test('sets options on a select', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'select', id: 'a', key: 'color', label: 'Color' }];
      const options = [
        { label: 'Red', value: 'red' },
        { label: 'Green', value: 'green' },
        { label: 'Blue', value: 'blue' },
      ];
      const result = parseResult(await handleSetFormOptions({ formId, componentId: 'a', options }));
      expect(result.count).toBe(3);
      expect(form.schema.components[0].values).toHaveLength(3);
    });

    test('rejects options on non-option field', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleSetFormOptions({
          formId,
          componentId: 'a',
          options: [{ label: 'A', value: 'a' }],
        })
      ).rejects.toThrow('does not support options');
    });
  });
});
