import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from '../helpers';
import { dispatchToolCall, TOOL_DEFINITIONS } from '../../src/handlers';
import {
  handleFormHistory,
  clearAllHistory,
  getHistorySize,
} from '../../src/handlers/core/form-history';

describe('handler registry', () => {
  beforeEach(() => {
    clearForms();
    clearAllHistory();
  });

  test('all tool definitions have unique names', () => {
    const names = TOOL_DEFINITIONS.map((td) => td.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('has at least 8 tools registered', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
  });

  test('dispatch routes to create_form', async () => {
    const result = await dispatchToolCall('create_form', { name: 'Test' });
    const data = JSON.parse(result.content[0].text);
    expect(data.formId).toMatch(/^form_/);
  });

  test('dispatch throws for unknown tool', async () => {
    await expect(dispatchToolCall('nonexistent_tool', {})).rejects.toThrow('Unknown tool');
  });

  test('dispatch auto-pushes undo snapshot for mutating tools', async () => {
    const { formId } = createForm();
    // Add a component via dispatch (should auto-snapshot)
    await dispatchToolCall('add_form_component', { formId, type: 'textfield', label: 'Name' });
    expect(getHistorySize(formId).undoCount).toBe(1);

    // Undo should restore empty state
    const result = parseResult(await handleFormHistory({ formId, action: 'undo' }));
    expect(result.componentCount).toBe(0);
  });

  test('dispatch does not push undo snapshot for read-only tools', async () => {
    const { formId } = createForm();
    await dispatchToolCall('inspect_form', { formId });
    expect(getHistorySize(formId).undoCount).toBe(0);
  });
});
