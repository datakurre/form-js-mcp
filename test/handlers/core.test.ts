import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { handleCreateForm } from '../../src/handlers/core/create-form';
import { handleImportFormSchema } from '../../src/handlers/core/import-form-schema';
import { handleExportForm } from '../../src/handlers/core/export-form';
import { handleDeleteForm } from '../../src/handlers/core/delete-form';
import { handleListForms } from '../../src/handlers/core/list-forms';
import { handleCloneForm } from '../../src/handlers/core/clone-form';
import { handleValidateForm } from '../../src/handlers/core/validate-form';
import { handleSummarizeForm } from '../../src/handlers/core/summarize-form';
import { handleGetFormVariables } from '../../src/handlers/core/get-form-variables';

describe('core handlers', () => {
  beforeEach(() => {
    clearForms();
  });

  // ── create_form ────────────────────────────────────────────────────────

  describe('create_form', () => {
    test('creates an empty form', async () => {
      const result = parseResult(await handleCreateForm({}));
      expect(result.formId).toMatch(/^form_/);
      expect(result.schema.type).toBe('default');
      expect(result.schema.components).toEqual([]);
    });

    test('creates a form with name and execution platform', async () => {
      const result = parseResult(
        await handleCreateForm({
          name: 'Invoice',
          executionPlatform: 'Camunda Cloud',
          executionPlatformVersion: '8.8.0',
        })
      );
      expect(result.name).toBe('Invoice');
      expect(result.schema.executionPlatform).toBe('Camunda Cloud');
      expect(result.schema.executionPlatformVersion).toBe('8.8.0');
    });
  });

  // ── import_form_schema ─────────────────────────────────────────────────

  describe('import_form_schema', () => {
    test('imports a schema from JSON object', async () => {
      const schema = {
        type: 'default',
        components: [{ type: 'textfield', id: 'f1', key: 'name', label: 'Name' }],
      };
      const result = parseResult(await handleImportFormSchema({ schema }));
      expect(result.formId).toMatch(/^form_/);
      expect(result.componentCount).toBe(1);
    });

    test('imports a schema from JSON string', async () => {
      const schema = JSON.stringify({
        type: 'default',
        components: [{ type: 'textfield', id: 'f1', key: 'name', label: 'Name' }],
      });
      const result = parseResult(await handleImportFormSchema({ schema }));
      expect(result.componentCount).toBe(1);
    });

    test('rejects invalid schema', async () => {
      await expect(handleImportFormSchema({ schema: 'not json' })).rejects.toThrow();
    });

    test('rejects schema without components', async () => {
      await expect(handleImportFormSchema({ schema: { type: 'default' } })).rejects.toThrow(
        'components'
      );
    });
  });

  // ── export_form ────────────────────────────────────────────────────────

  describe('export_form', () => {
    test('exports form as JSON', async () => {
      const { formId } = createForm('Test');
      const result = await handleExportForm({ formId });
      const json = JSON.parse(result.content[0].text);
      expect(json.type).toBe('default');
      expect(json.components).toEqual([]);
    });

    test('rejects unknown form', async () => {
      await expect(handleExportForm({ formId: 'nonexistent' })).rejects.toThrow('not found');
    });
  });

  // ── delete_form ────────────────────────────────────────────────────────

  describe('delete_form', () => {
    test('deletes a form', async () => {
      const { formId } = createForm();
      const result = parseResult(await handleDeleteForm({ formId }));
      expect(result.deleted).toBe(formId);

      // Cannot delete again
      await expect(handleDeleteForm({ formId })).rejects.toThrow('not found');
    });
  });

  // ── list_forms ─────────────────────────────────────────────────────────

  describe('list_forms', () => {
    test('lists empty', async () => {
      const result = parseResult(await handleListForms());
      expect(result.count).toBe(0);
    });

    test('lists multiple forms', async () => {
      createForm('A');
      createForm('B');
      const result = parseResult(await handleListForms());
      expect(result.count).toBe(2);
    });
  });

  // ── clone_form ─────────────────────────────────────────────────────────

  describe('clone_form', () => {
    test('clones a form with new IDs', async () => {
      const { formId, form } = createForm('Original');
      form.schema.components = [
        { type: 'textfield', id: 'tf1', key: 'name', label: 'Name' },
        { type: 'number', id: 'n1', key: 'age', label: 'Age' },
      ];

      const result = parseResult(await handleCloneForm({ formId }));
      expect(result.formId).not.toBe(formId);
      expect(result.name).toBe('Original (copy)');
      expect(result.componentCount).toBe(2);
    });

    test('clones with custom name', async () => {
      const { formId } = createForm('Original');
      const result = parseResult(await handleCloneForm({ formId, name: 'My Clone' }));
      expect(result.name).toBe('My Clone');
    });
  });

  // ── validate_form ──────────────────────────────────────────────────────

  describe('validate_form', () => {
    test('validates a clean form', async () => {
      const { formId } = createForm();
      const result = parseResult(await handleValidateForm({ formId }));
      expect(result.valid).toBe(true);
      expect(result.issueCount).toBe(0);
    });

    test('detects duplicate keys', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'N1' },
        { type: 'textfield', id: 'b', key: 'name', label: 'N2' },
      ];
      const result = parseResult(await handleValidateForm({ formId }));
      expect(result.valid).toBe(false);
      expect(result.issues.some((i: any) => i.message.includes('Duplicate key'))).toBe(true);
    });

    test('detects duplicate IDs', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'same', key: 'a' },
        { type: 'number', id: 'same', key: 'b' },
      ];
      const result = parseResult(await handleValidateForm({ formId }));
      expect(result.valid).toBe(false);
      expect(result.issues.some((i: any) => i.message.includes('Duplicate component ID'))).toBe(
        true
      );
    });

    test('detects missing key on keyed type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a' }];
      const result = parseResult(await handleValidateForm({ formId }));
      expect(result.valid).toBe(false);
      expect(result.issues.some((i: any) => i.message.includes('missing "key"'))).toBe(true);
    });
  });

  // ── summarize_form ─────────────────────────────────────────────────────

  describe('summarize_form', () => {
    test('summarizes a form', async () => {
      const { formId, form } = createForm('Test');
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'Name' },
        { type: 'number', id: 'b', key: 'age', label: 'Age' },
        { type: 'text', id: 'c', text: 'Hello' },
      ];
      const result = parseResult(await handleSummarizeForm({ formId }));
      expect(result.totalComponents).toBe(3);
      expect(result.componentsByType.textfield).toBe(1);
      expect(result.componentsByType.number).toBe(1);
      expect(result.variableCount).toBe(2);
    });
  });

  // ── get_form_variables ─────────────────────────────────────────────────

  describe('get_form_variables', () => {
    test('extracts variable keys', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
        { type: 'text', id: 'c', text: 'Static' },
      ];
      const result = parseResult(await handleGetFormVariables({ formId }));
      expect(result.inputKeys).toContain('name');
      expect(result.inputKeys).toContain('age');
      expect(result.total).toBe(2);
    });
  });
});
