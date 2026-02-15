import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { handleCreateForm } from '../../src/handlers/core/create-form';
import { handleDeleteForm } from '../../src/handlers/core/delete-form';
import { handleInspectForm } from '../../src/handlers/core/inspect-form';
import { handleModifyFormComponent } from '../../src/handlers/components/modify-form-component';

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

  // ── import_form_schema (via create_form with schema) ─────────────────

  describe('import_form_schema (via create_form)', () => {
    test('imports a schema from JSON object', async () => {
      const schema = {
        type: 'default',
        components: [{ type: 'textfield', id: 'f1', key: 'name', label: 'Name' }],
      };
      const result = parseResult(await handleCreateForm({ schema }));
      expect(result.formId).toMatch(/^form_/);
      expect(result.componentCount).toBe(1);
    });

    test('imports a schema from JSON string', async () => {
      const schema = JSON.stringify({
        type: 'default',
        components: [{ type: 'textfield', id: 'f1', key: 'name', label: 'Name' }],
      });
      const result = parseResult(await handleCreateForm({ schema }));
      expect(result.componentCount).toBe(1);
    });

    test('rejects invalid schema', async () => {
      await expect(handleCreateForm({ schema: 'not json' })).rejects.toThrow();
    });

    test('rejects schema without components', async () => {
      await expect(handleCreateForm({ schema: { type: 'default' } })).rejects.toThrow('components');
    });
  });

  // ── export_form (via inspect_form with schema facet) ────────────────

  describe('export_form (via inspect_form)', () => {
    test('exports form as JSON', async () => {
      const { formId } = createForm('Test');
      const result = parseResult(await handleInspectForm({ formId, include: ['schema'] }));
      const json = JSON.parse(result.schema);
      expect(json.type).toBe('default');
      expect(json.components).toEqual([]);
    });

    test('blocks export when form has validation errors', async () => {
      const { formId, form } = createForm('Invalid');
      // Add a keyed type without a key — produces a validation error
      form.schema.components = [{ type: 'textfield', id: 'nokey' }];
      await expect(handleInspectForm({ formId, include: ['schema'] })).rejects.toThrow(
        'Export blocked'
      );
    });

    test('allows export with skipValidation=true despite errors', async () => {
      const { formId, form } = createForm('Invalid');
      form.schema.components = [{ type: 'textfield', id: 'nokey' }];
      const result = parseResult(
        await handleInspectForm({ formId, include: ['schema'], skipValidation: true })
      );
      const json = JSON.parse(result.schema);
      expect(json.components).toHaveLength(1);
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

  // ── list_forms (via inspect_form without formId) ────────────────────

  describe('list_forms (via inspect_form)', () => {
    test('lists empty', async () => {
      const result = parseResult(await handleInspectForm({}));
      expect(result.count).toBe(0);
    });

    test('lists multiple forms', async () => {
      createForm('A');
      createForm('B');
      const result = parseResult(await handleInspectForm({}));
      expect(result.count).toBe(2);
    });
  });

  // ── clone_form (via create_form with cloneFromId) ───────────────────

  describe('clone_form (via create_form)', () => {
    test('clones a form with new IDs', async () => {
      const { formId, form } = createForm('Original');
      form.schema.components = [
        { type: 'textfield', id: 'tf1', key: 'name', label: 'Name' },
        { type: 'number', id: 'n1', key: 'age', label: 'Age' },
      ];

      const result = parseResult(await handleCreateForm({ cloneFromId: formId }));
      expect(result.formId).not.toBe(formId);
      expect(result.name).toBe('Original (copy)');
      expect(result.componentCount).toBe(2);
    });

    test('clones with custom name', async () => {
      const { formId } = createForm('Original');
      const result = parseResult(await handleCreateForm({ cloneFromId: formId, name: 'My Clone' }));
      expect(result.name).toBe('My Clone');
    });
  });

  // ── inspect_form (validation facet) ─────────────────────────────────────

  describe('inspect_form — validation', () => {
    test('validates a clean form', async () => {
      const { formId } = createForm();
      const result = parseResult(await handleInspectForm({ formId, include: ['validation'] }));
      expect(result.validation.valid).toBe(true);
      expect(result.validation.issueCount).toBe(0);
    });

    test('detects duplicate keys', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'N1' },
        { type: 'textfield', id: 'b', key: 'name', label: 'N2' },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['validation'] }));
      expect(result.validation.valid).toBe(false);
      expect(result.validation.issues.some((i: any) => i.message.includes('Duplicate key'))).toBe(
        true
      );
    });

    test('detects duplicate IDs', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'same', key: 'a' },
        { type: 'number', id: 'same', key: 'b' },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['validation'] }));
      expect(result.validation.valid).toBe(false);
      expect(
        result.validation.issues.some((i: any) => i.message.includes('Duplicate component ID'))
      ).toBe(true);
    });

    test('detects missing key on keyed type', async () => {
      const { formId, form } = createForm();
      form.schema.components = [{ type: 'textfield', id: 'a' }];
      const result = parseResult(await handleInspectForm({ formId, include: ['validation'] }));
      expect(result.validation.valid).toBe(false);
      expect(result.validation.issues.some((i: any) => i.message.includes('missing "key"'))).toBe(
        true
      );
    });

    test('excludes warnings when includeWarnings=false', async () => {
      const { formId, form } = createForm();
      // Unknown type produces warning, missing key produces error
      form.schema.components = [
        { type: 'textfield', id: 'a' },
        { type: 'fancywidget', id: 'b' },
      ];
      const result = parseResult(
        await handleInspectForm({ formId, include: ['validation'], includeWarnings: false })
      );
      // Should only have errors, no warnings
      for (const issue of result.validation.issues) {
        expect(issue.severity).toBe('error');
      }
    });
  });

  // ── inspect_form (summary facet) ──────────────────────────────────────

  describe('inspect_form — summary', () => {
    test('summarizes a form', async () => {
      const { formId, form } = createForm('Test');
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', label: 'Name' },
        { type: 'number', id: 'b', key: 'age', label: 'Age' },
        { type: 'text', id: 'c', text: 'Hello' },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['summary'] }));
      expect(result.summary.totalComponents).toBe(3);
      expect(result.summary.componentsByType.textfield).toBe(1);
      expect(result.summary.componentsByType.number).toBe(1);
      expect(result.summary.variableCount).toBe(2);
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
      const result = parseResult(await handleInspectForm({ formId, include: ['summary'] }));
      expect(result.summary.totalComponents).toBe(4);
      expect(result.summary.nestingDepth).toBeGreaterThanOrEqual(1);
      expect(result.summary.variableCount).toBe(2);
      expect(result.summary.layoutRows).toBeGreaterThanOrEqual(1);
      expect(result.summary.hasValidation).toBe(true);
      expect(result.summary.hasConditionals).toBe(true);
      expect(result.summary.schemaVersion).toBeDefined();
    });

    test('summarizes empty form', async () => {
      const { formId } = createForm('Empty');
      const result = parseResult(await handleInspectForm({ formId, include: ['summary'] }));
      expect(result.summary.totalComponents).toBe(0);
      expect(result.summary.variableCount).toBe(0);
      expect(result.summary.hasValidation).toBe(false);
      expect(result.summary.hasConditionals).toBe(false);
      expect(result.summary.nestingDepth).toBe(0);
      expect(result.summary.layoutRows).toBe(0);
    });
  });

  // ── inspect_form (variables facet) ────────────────────────────────────

  describe('inspect_form — variables', () => {
    test('extracts variable keys', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
        { type: 'text', id: 'c', text: 'Static' },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['variables'] }));
      expect(result.variables.inputKeys).toContain('name');
      expect(result.variables.inputKeys).toContain('age');
      expect(result.variables.total).toBe(2);
    });

    test('detects expression fields', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'select', id: 'a', key: 'color', valuesExpression: '=colors' },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['variables'] }));
      expect(result.variables.expressionFieldCount).toBe(1);
    });

    test('detects conditional fields', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name', conditional: { hide: '=x = true' } },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['variables'] }));
      expect(result.variables.conditionalFieldCount).toBe(1);
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
      const result = parseResult(await handleInspectForm({ formId, include: ['variables'] }));
      expect(result.variables.inputKeys).toContain('innerKey');
      expect(result.variables.inputKeys).toContain('sel');
      expect(result.variables.expressionFieldCount).toBe(1);
      expect(result.variables.total).toBe(2);
    });

    test('deduplicates keys', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'textfield', id: 'b', key: 'name' },
      ];
      const result = parseResult(await handleInspectForm({ formId, include: ['variables'] }));
      expect(result.variables.total).toBe(1);
    });
  });

  // ── inspect_form (all facets default) ─────────────────────────────────

  describe('inspect_form — all facets', () => {
    test('returns all facets by default', async () => {
      const { formId, form } = createForm('All');
      form.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      const result = parseResult(await handleInspectForm({ formId }));
      expect(result.summary).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.variables).toBeDefined();
    });
  });

  // ── diff (via inspect_form with diff facet) ─────────────────────────

  describe('inspect_form — diff', () => {
    test('identical forms', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      f2.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];

      const result = parseResult(
        await handleInspectForm({ formId: id1, include: ['diff'], compareFormId: id2 })
      );
      expect(result.diff.identical).toBe(true);
      expect(result.diff.added).toHaveLength(0);
      expect(result.diff.removed).toHaveLength(0);
      expect(result.diff.changed).toHaveLength(0);
    });

    test('different forms — added and removed', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [{ type: 'textfield', id: 'a', key: 'name' }];
      f2.schema.components = [{ type: 'number', id: 'b', key: 'age' }];

      const result = parseResult(
        await handleInspectForm({ formId: id1, include: ['diff'], compareFormId: id2 })
      );
      expect(result.diff.identical).toBe(false);
      expect(result.diff.removed).toHaveLength(1);
      expect(result.diff.removed[0].id).toBe('a');
      expect(result.diff.added).toHaveLength(1);
      expect(result.diff.added[0].id).toBe('b');
    });

    test('changed properties', async () => {
      const { formId: id1, form: f1 } = createForm('A');
      const { formId: id2, form: f2 } = createForm('B');
      f1.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Name' }];
      f2.schema.components = [{ type: 'textfield', id: 'a', key: 'name', label: 'Full Name' }];

      const result = parseResult(
        await handleInspectForm({ formId: id1, include: ['diff'], compareFormId: id2 })
      );
      expect(result.diff.identical).toBe(false);
      expect(result.diff.changed).toHaveLength(1);
      expect(result.diff.changed[0].componentId).toBe('a');
      expect(result.diff.changed[0].changes.some((c: any) => c.property === 'label')).toBe(true);
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

      const result = parseResult(
        await handleInspectForm({ formId: id1, include: ['diff'], compareFormId: id2 })
      );
      expect(result.diff.identical).toBe(false);
      expect(result.diff.changed.some((c: any) => c.componentId === 'inner')).toBe(true);
    });

    test('requires compareFormId', async () => {
      const { formId } = createForm('A');
      await expect(handleInspectForm({ formId, include: ['diff'] })).rejects.toThrow(
        'compareFormId'
      );
    });
  });

  // ── auto_layout_form (via modify_form_component) ───────────────────────

  describe('auto_layout_form (via modify_form_component)', () => {
    test('single column layout', async () => {
      const { formId, form } = createForm();
      form.schema.components = [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
      ];
      const result = parseResult(
        await handleModifyFormComponent({ formId, action: 'auto-layout' })
      );
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
      const result = parseResult(
        await handleModifyFormComponent({ formId, action: 'auto-layout', strategy: 'two-column' })
      );
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
      const result = parseResult(
        await handleModifyFormComponent({ formId, action: 'auto-layout', strategy: 'compact' })
      );
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
      const result = parseResult(
        await handleModifyFormComponent({ formId, action: 'auto-layout', strategy: 'two-column' })
      );
      expect(result.componentsLaidOut).toBe(3);
      // Separator should be full width
      expect(form.schema.components[1].layout?.columns).toBe(16);
    });

    test('rejects invalid strategy', async () => {
      const { formId } = createForm();
      await expect(
        handleModifyFormComponent({ formId, action: 'auto-layout', strategy: 'invalid' })
      ).rejects.toThrow('Invalid strategy');
    });
  });
});
