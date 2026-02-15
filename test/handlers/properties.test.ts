import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { handleSetFormComponentProperties } from '../../src/handlers/properties/set-form-component-properties';
import { handleInspectForm } from '../../src/handlers/core/inspect-form';

describe('property handlers', () => {
  beforeEach(() => {
    clearForms();
  });

  // ── get component properties (via inspect_form with components facet) ──

  describe('get component properties (via inspect_form)', () => {
    test('returns component properties', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'Name', description: 'Enter name' },
      ];
      const result = parseResult(
        await handleInspectForm({ formId, include: ['components'], componentId: 'a' })
      );
      expect(result.components.properties.key).toBe('name');
      expect(result.components.properties.label).toBe('Name');
      expect(result.components.properties.description).toBe('Enter name');
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
        await handleInspectForm({ formId, include: ['components'], componentId: 'g1' })
      );
      expect(result.components.properties).not.toHaveProperty('components');
      expect(result.components.hasChildren).toBe(true);
      expect(result.components.childCount).toBe(1);
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

  // ── type change via set_form_component_properties ──────────────────────

  describe('type change (via properties.type)', () => {
    test('compatible replacement preserves key, label, validate', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'textfield',
          id: 'a',
          key: 'name',
          label: 'Name',
          validate: { required: true },
        },
      ];
      const result = parseResult(
        await handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { type: 'textarea' },
        })
      );
      expect(result.updated).toContain('type');
      expect(result.updated).toContain('key');
      expect(result.updated).toContain('label');
      expect(result.updated).toContain('validate');
      expect(form.schema.components[0].type).toBe('textarea');
      expect(form.schema.components[0].key).toBe('name');
    });

    test('incompatible replacement loses type-specific props', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'select',
          id: 'a',
          key: 'choice',
          label: 'Pick one',
          values: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      ];
      const result = parseResult(
        await handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { type: 'textfield' },
        })
      );
      expect(result.removed).toContain('values');
      expect(form.schema.components[0].type).toBe('textfield');
      expect(form.schema.components[0].values).toBeUndefined();
      // key and label should be preserved
      expect(form.schema.components[0].key).toBe('choice');
      expect(form.schema.components[0].label).toBe('Pick one');
    });

    test('keyed to non-keyed removes key and validate', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'textfield',
          id: 'a',
          key: 'name',
          label: 'Name',
          validate: { required: true },
        },
      ];
      const result = parseResult(
        await handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { type: 'text' },
        })
      );
      expect(result.removed).toContain('key');
      expect(result.removed).toContain('validate');
      expect(form.schema.components[0].type).toBe('text');
      expect(form.schema.components[0].key).toBeUndefined();
    });

    test('rejects same type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { type: 'textfield' },
        })
      ).rejects.toThrow('already type');
    });

    test('rejects unsupported type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { type: 'fancywidget' },
        })
      ).rejects.toThrow('Unsupported');
    });

    test('auto-generates key when replacing non-keyed to keyed type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'text', id: 'a', label: 'Notes' }];
      const result = parseResult(
        await handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { type: 'textfield' },
        })
      );
      expect(result.updated).toContain('type');
      expect(form.schema.components[0].key).toBeTruthy();
      expect(form.schema.components[0].type).toBe('textfield');
    });

    test('auto-generated key avoids duplicates', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'b', key: 'notes', label: 'Notes' },
        { type: 'text', id: 'a', label: 'Notes' },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { type: 'textfield' },
      });
      expect(form.schema.components[1].key).toBeTruthy();
      // Should not be 'notes' since that already exists
      expect(form.schema.components[1].key).not.toBe('notes');
    });
  });

  // ── validation via set_form_component_properties ───────────────────────

  describe('validation (via properties.validate)', () => {
    test('sets validation rules', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { validate: { required: true, minLength: 2, maxLength: 100 } },
      });
      expect(form.schema.components[0].validate?.required).toBe(true);
      expect(form.schema.components[0].validate?.minLength).toBe(2);
      expect(form.schema.components[0].validate?.maxLength).toBe(100);
    });

    test('sets numeric validation rules (min, max)', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'number', id: 'a', key: 'age' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { validate: { min: 0, max: 150 } },
      });
      expect(form.schema.components[0].validate?.min).toBe(0);
      expect(form.schema.components[0].validate?.max).toBe(150);
    });

    test('sets pattern and validationError', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'email' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: {
          validate: { pattern: '^[^@]+@[^@]+$', validationError: 'Please enter a valid email' },
        },
      });
      expect(form.schema.components[0].validate?.pattern).toBe('^[^@]+@[^@]+$');
      expect(form.schema.components[0].validate?.validationError).toBe(
        'Please enter a valid email'
      );
    });

    test('merges with existing validation', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', validate: { required: true } },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { validate: { minLength: 3 } },
      });
      expect(form.schema.components[0].validate?.required).toBe(true);
      expect(form.schema.components[0].validate?.minLength).toBe(3);
    });
  });

  // ── conditional via set_form_component_properties ──────────────────────

  describe('conditional (via properties.conditional)', () => {
    test('sets conditional hide expression', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { conditional: { hide: '=showName = false' } },
      });
      expect(form.schema.components[0].conditional?.hide).toBe('=showName = false');
    });

    test('clears conditional when set to null', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', conditional: { hide: '=x > 1' } },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { conditional: null },
      });
      expect(form.schema.components[0].conditional).toBeUndefined();
    });
  });

  // ── layout via set_form_component_properties ───────────────────────────

  describe('layout (via properties.layout)', () => {
    test('sets column width', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { layout: { columns: 8 } },
      });
      expect(form.schema.components[0].layout?.columns).toBe(8);
    });

    test('rejects out-of-range columns', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { layout: { columns: 0 } },
        })
      ).rejects.toThrow('columns');
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { layout: { columns: 17 } },
        })
      ).rejects.toThrow('columns');
    });

    test('sets row identifier', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { layout: { row: 'Row_1' } },
      });
      expect(form.schema.components[0].layout?.row).toBe('Row_1');
    });

    test('sets both columns and row', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { layout: { columns: 8, row: 'Row_1' } },
      });
      expect(form.schema.components[0].layout?.columns).toBe(8);
      expect(form.schema.components[0].layout?.row).toBe('Row_1');
    });

    test('clears row with empty string', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', layout: { columns: 8, row: 'Row_1' } },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { layout: { row: '' } },
      });
      expect(form.schema.components[0].layout?.row).toBeUndefined();
      expect(form.schema.components[0].layout?.columns).toBe(8);
    });
  });

  // ── options via set_form_component_properties ──────────────────────────

  describe('options (via properties.values/valuesKey/valuesExpression)', () => {
    test('sets options on a select', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'select', id: 'a', key: 'color', label: 'Color' }];
      const options = [
        { label: 'Red', value: 'red' },
        { label: 'Green', value: 'green' },
        { label: 'Blue', value: 'blue' },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { values: options },
      });
      expect(form.schema.components[0].values).toHaveLength(3);
    });

    test('rejects options on non-option field', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { values: [{ label: 'A', value: 'a' }] },
        })
      ).rejects.toThrow('does not support options');
    });

    test('clears valuesExpression when setting static options', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'select', id: 'a', key: 'sel', valuesExpression: '=items' },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { values: [{ label: 'A', value: 'a' }] },
      });
      expect(form.schema.components[0].valuesExpression).toBeUndefined();
      expect(form.schema.components[0].values).toHaveLength(1);
    });

    test('rejects option missing label', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'select', id: 'a', key: 'sel' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { values: [{ label: '', value: 'a' }] },
        })
      ).rejects.toThrow('label and value');
    });

    test('sets valuesExpression for dynamic options', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'select',
          id: 'a',
          key: 'sel',
          values: [{ label: 'A', value: 'a' }],
        },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { valuesExpression: '=availableItems' },
      });
      expect(form.schema.components[0].valuesExpression).toBe('=availableItems');
      expect(form.schema.components[0].values).toBeUndefined();
    });

    test('sets valuesKey for dynamic options from input data', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'radio',
          id: 'a',
          key: 'choice',
          values: [{ label: 'X', value: 'x' }],
        },
      ];
      await handleSetFormComponentProperties({
        formId,
        componentId: 'a',
        properties: { valuesKey: 'dynamicOptions' },
      });
      expect(form.schema.components[0].valuesKey).toBe('dynamicOptions');
      expect(form.schema.components[0].values).toBeUndefined();
    });

    test('rejects multiple option sources at once', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'select', id: 'a', key: 'sel' }];
      await expect(
        handleSetFormComponentProperties({
          formId,
          componentId: 'a',
          properties: { values: [{ label: 'A', value: 'a' }], valuesKey: 'items' },
        })
      ).rejects.toThrow('Only one');
    });
  });
});
