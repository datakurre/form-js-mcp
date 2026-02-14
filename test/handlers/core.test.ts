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
import { handleDiffForms } from '../../src/handlers/core/diff-forms';
import { handleAutoLayoutForm } from '../../src/handlers/core/auto-layout-form';
import { handleBatchFormOperations } from '../../src/handlers/core/batch-form-operations';
import {
  handleFormHistory,
  pushSnapshot,
  clearAllHistory,
  clearHistory,
  getHistorySize,
} from '../../src/handlers/core/form-history';

describe('core handlers', () => {
  beforeEach(() => {
    clearForms();
    clearAllHistory();
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

    test('excludes warnings when includeWarnings=false', async () => {
      const { formId, form } = createForm();
      // Unknown type produces warning, missing key produces error
      form.schema.components = [
        { type: 'textfield', id: 'a' },
        { type: 'fancywidget', id: 'b' },
      ];
      const result = parseResult(await handleValidateForm({ formId, includeWarnings: false }));
      // Should only have errors, no warnings
      for (const issue of result.issues) {
        expect(issue.severity).toBe('error');
      }
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

    test('summarizes nested components with validation and conditionals', async () => {
      const { formId, form } = createForm('Nested');
      form.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [
            {
              type: 'textfield',
              id: 'a',
              key: 'name',
              label: 'Name',
              validate: { required: true },
              layout: { row: 'row1' },
            },
            {
              type: 'number',
              id: 'b',
              key: 'age',
              label: 'Age',
              conditional: { hide: '=age < 0' },
              layout: { row: 'row1' },
            },
          ],
        },
        { type: 'separator', id: 's1' },
      ];
      const result = parseResult(await handleSummarizeForm({ formId }));
      expect(result.totalComponents).toBe(4);
      expect(result.nestingDepth).toBeGreaterThanOrEqual(1);
      expect(result.variableCount).toBe(2);
      expect(result.layoutRows).toBeGreaterThanOrEqual(1);
      expect(result.hasValidation).toBe(true);
      expect(result.hasConditionals).toBe(true);
      expect(result.schemaVersion).toBeDefined();
    });

    test('summarizes empty form', async () => {
      const { formId } = createForm('Empty');
      const result = parseResult(await handleSummarizeForm({ formId }));
      expect(result.totalComponents).toBe(0);
      expect(result.variableCount).toBe(0);
      expect(result.hasValidation).toBe(false);
      expect(result.hasConditionals).toBe(false);
      expect(result.nestingDepth).toBe(0);
      expect(result.layoutRows).toBe(0);
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

    test('detects expression fields', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'select', id: 'a', key: 'color', valuesExpression: '=colors' },
      ];
      const result = parseResult(await handleGetFormVariables({ formId }));
      expect(result.expressionFieldCount).toBe(1);
    });

    test('detects conditional fields', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', conditional: { hide: '=x = true' } },
      ];
      const result = parseResult(await handleGetFormVariables({ formId }));
      expect(result.conditionalFieldCount).toBe(1);
    });

    test('handles nested components', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [
            { type: 'textfield', id: 'inner', key: 'innerKey' },
            { type: 'select', id: 's1', key: 'sel', valuesExpression: '=opts' },
          ],
        },
      ];
      const result = parseResult(await handleGetFormVariables({ formId }));
      expect(result.inputKeys).toContain('innerKey');
      expect(result.inputKeys).toContain('sel');
      expect(result.expressionFieldCount).toBe(1);
      expect(result.total).toBe(2);
    });

    test('deduplicates keys', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'textfield', id: 'b', key: 'name' },
      ];
      const result = parseResult(await handleGetFormVariables({ formId }));
      expect(result.total).toBe(1);
    });
  });

  // ── diff_forms ─────────────────────────────────────────────────────────

  describe('diff_forms', () => {
    test('identical forms', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      f2.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];

      const result = parseResult(await handleDiffForms({ formId1: id1, formId2: id2 }));
      expect(result.identical).toBe(true);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
    });

    test('different forms — added and removed', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      f2.schema.components = [{ type: 'number', id: 'b', key: 'age' }];

      const result = parseResult(await handleDiffForms({ formId1: id1, formId2: id2 }));
      expect(result.identical).toBe(false);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].id).toBe('a');
      expect(result.added).toHaveLength(1);
      expect(result.added[0].id).toBe('b');
    });

    test('changed properties', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      f2.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Full Name' }];

      const result = parseResult(await handleDiffForms({ formId1: id1, formId2: id2 }));
      expect(result.identical).toBe(false);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].componentId).toBe('a');
      expect(result.changed[0].changes.some((c: any) => c.property === 'label')).toBe(true);
    });

    test('nested diffs', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'textfield', id: 'inner', key: 'x' }],
        },
      ];
      f2.schema.components = [
        {
          type: 'group',
          id: 'g1',
          components: [{ type: 'textfield', id: 'inner', key: 'y' }],
        },
      ];

      const result = parseResult(await handleDiffForms({ formId1: id1, formId2: id2 }));
      expect(result.identical).toBe(false);
      expect(result.changed.some((c: any) => c.componentId === 'inner')).toBe(true);
    });
  });

  // ── auto_layout_form ───────────────────────────────────────────────────

  describe('auto_layout_form', () => {
    test('single column layout', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
      ];
      const result = parseResult(await handleAutoLayoutForm({ formId }));
      expect(result.strategy).toBe('single-column');
      expect(result.componentsLaidOut).toBe(2);
      expect(form.schema.components[0].layout?.columns).toBe(16);
      expect(form.schema.components[1].layout?.columns).toBe(16);
    });

    test('two column layout', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'first' },
        { type: 'textfield', id: 'b', key: 'last' },
      ];
      const result = parseResult(await handleAutoLayoutForm({ formId, strategy: 'two-column' }));
      expect(result.strategy).toBe('two-column');
      expect(result.componentsLaidOut).toBe(2);
      expect(form.schema.components[0].layout?.row).toBeDefined();
      expect(form.schema.components[0].layout?.row).toBe(form.schema.components[1].layout?.row);
    });

    test('compact layout', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'checkbox', id: 'b', key: 'agree' },
        { type: 'separator', id: 'c' },
      ];
      const result = parseResult(await handleAutoLayoutForm({ formId, strategy: 'compact' }));
      expect(result.strategy).toBe('compact');
      expect(result.componentsLaidOut).toBeGreaterThanOrEqual(3);
      // Separator is full-width
      expect(form.schema.components[2].layout?.columns).toBe(16);
    });

    test('two column with full-width separators', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'first' },
        { type: 'separator', id: 's' },
        { type: 'textfield', id: 'b', key: 'last' },
      ];
      const result = parseResult(await handleAutoLayoutForm({ formId, strategy: 'two-column' }));
      expect(result.componentsLaidOut).toBe(3);
      // Separator should be full width
      expect(form.schema.components[1].layout?.columns).toBe(16);
    });

    test('rejects invalid strategy', async () => {
      const { formId } = createForm();
      await expect(handleAutoLayoutForm({ formId, strategy: 'invalid' })).rejects.toThrow(
        'Invalid strategy'
      );
    });
  });

  // ── batch_form_operations ──────────────────────────────────────────────

  describe('batch_form_operations', () => {
    test('batch succeeds', async () => {
      const { formId } = createForm();
      const result = parseResult(
        await handleBatchFormOperations({
          formId,
          operations: [
            {
              tool: 'add_form_component',
              args: { formId, type: 'textfield', label: 'Name' },
            },
            {
              tool: 'add_form_component',
              args: { formId, type: 'number', label: 'Age' },
            },
          ],
        })
      );
      expect(result.success).toBe(true);
      expect(result.completedOperations).toBe(2);
    });

    test('batch with error rolls back', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];

      const result = parseResult(
        await handleBatchFormOperations({
          formId,
          operations: [
            {
              tool: 'add_form_component',
              args: { formId, type: 'textfield', label: 'Extra' },
            },
            {
              tool: 'delete_form_component',
              args: { formId, componentId: 'nonexistent' },
            },
          ],
        })
      );
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      // Should have rolled back — only original component remains
      expect(form.schema.components).toHaveLength(1);
      expect(form.schema.components[0].id).toBe('a');
    });

    test('rejects empty operations', async () => {
      const { formId } = createForm();
      await expect(handleBatchFormOperations({ formId, operations: [] })).rejects.toThrow(
        'non-empty'
      );
    });

    test('prevents recursive batch calls', async () => {
      const { formId } = createForm();
      const result = parseResult(
        await handleBatchFormOperations({
          formId,
          operations: [
            {
              tool: 'batch_form_operations',
              args: { formId, operations: [] },
            },
          ],
        })
      );
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
    });
  });

  // ── form_history ───────────────────────────────────────────────────────

  describe('form_history', () => {
    test('undo mutation', async () => {
      const { formId, form } = createForm();
      form.schema.components = [];

      // Push a snapshot of the empty state before mutating
      pushSnapshot(formId, form.schema);

      // Simulate a mutation
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      form.version = 1;

      // Undo should restore empty state
      const result = parseResult(await handleFormHistory({ formId, action: 'undo' }));
      expect(result.action).toBe('undo');
      expect(result.componentCount).toBe(0);
      expect(form.schema.components).toHaveLength(0);
    });

    test('redo after undo', async () => {
      const { formId, form } = createForm();
      form.schema.components = [];

      pushSnapshot(formId, form.schema);
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      form.version = 1;

      // Undo
      await handleFormHistory({ formId, action: 'undo' });
      expect(form.schema.components).toHaveLength(0);

      // Redo
      const result = parseResult(await handleFormHistory({ formId, action: 'redo' }));
      expect(result.action).toBe('redo');
      expect(result.componentCount).toBe(1);
    });

    test('undo past start throws error', async () => {
      const { formId } = createForm();
      await expect(handleFormHistory({ formId, action: 'undo' })).rejects.toThrow(
        'Nothing to undo'
      );
    });

    test('redo without undo throws error', async () => {
      const { formId } = createForm();
      await expect(handleFormHistory({ formId, action: 'redo' })).rejects.toThrow(
        'Nothing to redo'
      );
    });

    test('invalid action throws error', async () => {
      const { formId } = createForm();
      await expect(handleFormHistory({ formId, action: 'rewind' })).rejects.toThrow(
        'Invalid action'
      );
    });

    test('clearHistory removes history for a form', () => {
      const { formId, form } = createForm();
      pushSnapshot(formId, form.schema);
      expect(getHistorySize(formId).undoCount).toBe(1);
      clearHistory(formId);
      expect(getHistorySize(formId).undoCount).toBe(0);
    });

    test('getHistorySize returns zero for unknown form', () => {
      const size = getHistorySize('nonexistent');
      expect(size.undoCount).toBe(0);
      expect(size.redoCount).toBe(0);
    });

    test('pushSnapshot clears redo stack', async () => {
      const { formId, form } = createForm();
      pushSnapshot(formId, form.schema);
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];

      // Undo to create redo entry
      await handleFormHistory({ formId, action: 'undo' });
      expect(getHistorySize(formId).redoCount).toBe(1);

      // New snapshot should clear redo stack
      pushSnapshot(formId, form.schema);
      expect(getHistorySize(formId).redoCount).toBe(0);
    });
  });
});
