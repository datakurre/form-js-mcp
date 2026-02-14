import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { handleAddFormComponent } from '../../src/handlers/components/add-form-component';
import { handleDeleteFormComponent } from '../../src/handlers/components/delete-form-component';
import { handleMoveFormComponent } from '../../src/handlers/components/move-form-component';
import { handleDuplicateFormComponent } from '../../src/handlers/components/duplicate-form-component';
import { handleListFormComponents } from '../../src/handlers/components/list-form-components';
import { handleReplaceFormComponent } from '../../src/handlers/components/replace-form-component';

describe('component handlers', () => {
  beforeEach(() => {
    clearForms();
  });

  // ── add_form_component ─────────────────────────────────────────────────

  describe('add_form_component', () => {
    test('adds a textfield to root', async () => {
      const { formId } = createForm();
      const result = parseResult(
        await handleAddFormComponent({ formId, type: 'textfield', label: 'Name' })
      );
      expect(result.component.type).toBe('textfield');
      expect(result.component.key).toBeTruthy();
      expect(result.component.label).toBe('Name');
      expect(result.totalComponents).toBe(1);
    });

    test('auto-generates unique keys', async () => {
      const { formId } = createForm();
      await handleAddFormComponent({ formId, type: 'textfield', label: 'Name' });
      const result = parseResult(
        await handleAddFormComponent({ formId, type: 'textfield', label: 'Name' })
      );
      expect(result.component.key).toMatch(/name\d*/i);
    });

    test('adds to a specific position', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'text', id: 'first' },
        { type: 'text', id: 'last' },
      ];
      await handleAddFormComponent({ formId, type: 'textfield', label: 'Middle', position: 1 });
      expect(form.schema.components[1].type).toBe('textfield');
    });

    test('rejects unsupported type', async () => {
      const { formId } = createForm();
      await expect(handleAddFormComponent({ formId, type: 'unknown_type' })).rejects.toThrow(
        'Unsupported'
      );
    });

    test('adds to a group container', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'group', id: 'g1', components: [] }];
      const result = parseResult(
        await handleAddFormComponent({ formId, type: 'textfield', label: 'Inner', parentId: 'g1' })
      );
      expect(result.component.type).toBe('textfield');
      expect(form.schema.components[0].components).toHaveLength(1);
    });

    test('non-keyed types do not get a key', async () => {
      const { formId } = createForm();
      const result = parseResult(await handleAddFormComponent({ formId, type: 'text' }));
      expect(result.component.key).toBeUndefined();
    });

    test('uses explicit key when provided', async () => {
      const { formId } = createForm();
      const result = parseResult(
        await handleAddFormComponent({ formId, type: 'textfield', key: 'myCustomKey' })
      );
      expect(result.component.key).toBe('myCustomKey');
    });

    test('rejects non-container parentId', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'tf1', key: 'name' }];
      await expect(
        handleAddFormComponent({ formId, type: 'text', parentId: 'tf1' })
      ).rejects.toThrow('not a container');
    });

    test('rejects unknown parentId', async () => {
      const { formId } = createForm();
      await expect(
        handleAddFormComponent({ formId, type: 'text', parentId: 'nope' })
      ).rejects.toThrow('not found');
    });

    test('passes additional properties to component', async () => {
      const { formId } = createForm();
      const result = parseResult(
        await handleAddFormComponent({
          formId,
          type: 'textfield',
          label: 'Email',
          properties: { description: 'Enter your email' },
        })
      );
      expect(result.component.description).toBe('Enter your email');
    });

    test('auto-generates key without label', async () => {
      const { formId } = createForm();
      const result = parseResult(await handleAddFormComponent({ formId, type: 'textfield' }));
      expect(result.component.key).toBeTruthy();
    });
  });

  // ── delete_form_component ──────────────────────────────────────────────

  describe('delete_form_component', () => {
    test('deletes a component', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
      ];
      const result = parseResult(await handleDeleteFormComponent({ formId, componentId: 'a' }));
      expect(result.deleted).toBe('a');
      expect(form.schema.components).toHaveLength(1);
    });

    test('rejects unknown component', async () => {
      const { formId } = createForm();
      await expect(handleDeleteFormComponent({ formId, componentId: 'nope' })).rejects.toThrow(
        'not found'
      );
    });
  });

  // ── move_form_component ────────────────────────────────────────────────

  describe('move_form_component', () => {
    test('reorders within root', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'first' },
        { type: 'textfield', id: 'b', key: 'second' },
      ];
      await handleMoveFormComponent({ formId, componentId: 'b', position: 0 });
      expect(form.schema.components[0].id).toBe('b');
      expect(form.schema.components[1].id).toBe('a');
    });

    test('reparents into a group', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'group', id: 'g1', components: [] },
        { type: 'textfield', id: 'a', key: 'field' },
      ];
      await handleMoveFormComponent({ formId, componentId: 'a', targetParentId: 'g1' });
      expect(form.schema.components).toHaveLength(1);
      expect(form.schema.components[0].components).toHaveLength(1);
    });

    test('rejects non-container target', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'first' },
        { type: 'textfield', id: 'b', key: 'second' },
      ];
      await expect(
        handleMoveFormComponent({ formId, componentId: 'a', targetParentId: 'b' })
      ).rejects.toThrow('not a container');
    });

    test('appends when position not specified', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'group', id: 'g1', components: [{ type: 'text', id: 'existing' }] },
        { type: 'textfield', id: 'a', key: 'field' },
      ];
      await handleMoveFormComponent({ formId, componentId: 'a', targetParentId: 'g1' });
      expect(form.schema.components[0].components).toHaveLength(2);
      expect(form.schema.components[0].components![1].id).toBe('a');
    });
  });

  // ── duplicate_form_component ───────────────────────────────────────────

  describe('duplicate_form_component', () => {
    test('duplicates with new ID and key', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      const result = parseResult(await handleDuplicateFormComponent({ formId, componentId: 'a' }));
      expect(result.component.id).not.toBe('a');
      expect(result.component.key).not.toBe('name');
      expect(form.schema.components).toHaveLength(2);
    });

    test('duplicates nested components', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'textfield', id: 'inner', key: 'field' }],
        },
      ];
      const result = parseResult(await handleDuplicateFormComponent({ formId, componentId: 'g1' }));
      expect(result.component.id).not.toBe('g1');
      expect(result.component.components).toHaveLength(1);
      expect(result.component.components[0].id).not.toBe('inner');
      expect(result.component.components[0].key).not.toBe('field');
      expect(form.schema.components).toHaveLength(2);
    });

    test('duplicates component without key', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'text', id: 't1' }];
      const result = parseResult(await handleDuplicateFormComponent({ formId, componentId: 't1' }));
      expect(result.component.id).not.toBe('t1');
      expect(result.component.key).toBeUndefined();
    });
  });

  // ── list_form_components ───────────────────────────────────────────────

  describe('list_form_components', () => {
    test('lists all components', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
        { type: 'text', id: 'c' },
      ];
      const result = parseResult(await handleListFormComponents({ formId }));
      expect(result.count).toBe(3);
    });

    test('filters by type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
      ];
      const result = parseResult(await handleListFormComponents({ formId, type: 'textfield' }));
      expect(result.count).toBe(1);
    });

    test('lists children of container', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'textfield', id: 'a', key: 'inner' }],
        },
      ];
      const result = parseResult(await handleListFormComponents({ formId, parentId: 'g1' }));
      expect(result.count).toBe(1);
    });

    test('parentId lists only direct children, not nested', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [
            {
              type: 'group',
              id: 'g2',
              label: 'Inner Group',
              components: [{ type: 'textfield', id: 'nested', key: 'nested' }],
            },
            { type: 'textfield', id: 'direct', key: 'direct' },
          ],
        },
      ];
      const result = parseResult(await handleListFormComponents({ formId, parentId: 'g1' }));
      // Should only list g2 and direct, not nested inside g2
      expect(result.count).toBe(2);
      const ids = result.components.map((c: any) => c.id);
      expect(ids).toContain('g2');
      expect(ids).toContain('direct');
      expect(ids).not.toContain('nested');
    });
  });

  // ── Implicit validation hints (P4.5) ───────────────────────────────────

  describe('implicit validation hints', () => {
    test('mutating handler returns _hints when hintLevel is full', async () => {
      const { formId, form } = createForm();
      form.hintLevel = 'full';
      // Add a keyed field without a key — will produce a validation error
      form.schema.components = [{ type: 'textfield', id: 'nokey' }];
      const result = parseResult(await handleAddFormComponent({ formId, type: 'text' }));
      expect(result._hints).toBeDefined();
      expect(result._hints.length).toBeGreaterThan(0);
      expect(result._hints.some((h: any) => h.severity === 'error')).toBe(true);
    });

    test('mutating handler omits _hints when hintLevel is none', async () => {
      const { formId, form } = createForm();
      form.hintLevel = 'none';
      form.schema.components = [{ type: 'textfield', id: 'nokey' }];
      const result = parseResult(await handleAddFormComponent({ formId, type: 'text' }));
      expect(result._hints).toBeUndefined();
    });

    test('mutating handler returns only errors when hintLevel is minimal', async () => {
      const { formId, form } = createForm();
      form.hintLevel = 'minimal';
      // Add an unknown type (produces warning) and a missing key (produces error)
      form.schema.components = [{ type: 'textfield', id: 'nokey' }];
      const result = parseResult(await handleAddFormComponent({ formId, type: 'text' }));
      expect(result._hints).toBeDefined();
      // Should only have errors, no warnings
      for (const hint of result._hints) {
        expect(hint.severity).toBe('error');
      }
    });

    test('no _hints when form is valid', async () => {
      const { formId, form } = createForm();
      form.hintLevel = 'full';
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      const result = parseResult(await handleDeleteFormComponent({ formId, componentId: 'a' }));
      // After deleting the only component, form is valid (empty)
      expect(result._hints).toBeUndefined();
    });
  });

  // ── replace_form_component ─────────────────────────────────────────────

  describe('replace_form_component', () => {
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
        await handleReplaceFormComponent({ formId, componentId: 'a', newType: 'textarea' })
      );
      expect(result.oldType).toBe('textfield');
      expect(result.newType).toBe('textarea');
      expect(result.preserved).toContain('key');
      expect(result.preserved).toContain('label');
      expect(result.preserved).toContain('validate');
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
        await handleReplaceFormComponent({ formId, componentId: 'a', newType: 'textfield' })
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
        await handleReplaceFormComponent({ formId, componentId: 'a', newType: 'text' })
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
        handleReplaceFormComponent({ formId, componentId: 'a', newType: 'textfield' })
      ).rejects.toThrow('already type');
    });

    test('rejects unsupported type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      await expect(
        handleReplaceFormComponent({ formId, componentId: 'a', newType: 'fancywidget' })
      ).rejects.toThrow('Unsupported');
    });

    test('auto-generates key when replacing non-keyed to keyed type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'text', id: 'a', label: 'Notes' }];
      const result = parseResult(
        await handleReplaceFormComponent({ formId, componentId: 'a', newType: 'textfield' })
      );
      expect(result.newType).toBe('textfield');
      expect(form.schema.components[0].key).toBeTruthy();
      expect(form.schema.components[0].type).toBe('textfield');
    });

    test('auto-generated key avoids duplicates', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'b', key: 'notes', label: 'Notes' },
        { type: 'text', id: 'a', label: 'Notes' },
      ];
      await handleReplaceFormComponent({ formId, componentId: 'a', newType: 'textfield' });
      expect(form.schema.components[1].key).toBeTruthy();
      // Should not be 'notes' since that already exists
      expect(form.schema.components[1].key).not.toBe('notes');
    });
  });
});
