import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { handleAddFormComponent } from '../../src/handlers/components/add-form-component';
import { handleDeleteFormComponent } from '../../src/handlers/components/delete-form-component';
import { handleMoveFormComponent } from '../../src/handlers/components/move-form-component';
import { handleDuplicateFormComponent } from '../../src/handlers/components/duplicate-form-component';
import { handleListFormComponents } from '../../src/handlers/components/list-form-components';

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
});
