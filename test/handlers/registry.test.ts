import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms } from '../helpers';
import { dispatchToolCall, TOOL_DEFINITIONS } from '../../src/handlers';

describe('handler registry', () => {
  beforeEach(() => {
    clearForms();
  });

  test('all tool definitions have unique names', () => {
    const names = TOOL_DEFINITIONS.map((td) => td.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('has at least 20 tools registered', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(20);
  });

  test('dispatch routes to create_form', async () => {
    const result = await dispatchToolCall('create_form', { name: 'Test' });
    const data = JSON.parse(result.content[0].text);
    expect(data.formId).toMatch(/^form_/);
  });

  test('dispatch throws for unknown tool', async () => {
    await expect(dispatchToolCall('nonexistent_tool', {})).rejects.toThrow('Unknown tool');
  });
});
