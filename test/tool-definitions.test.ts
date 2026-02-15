import { describe, test, expect } from 'vitest';
import { TOOL_DEFINITIONS } from '../src/handlers';

describe('tool definitions', () => {
  test('every definition has a name', () => {
    for (const td of TOOL_DEFINITIONS) {
      expect(td.name).toBeTruthy();
      expect(typeof td.name).toBe('string');
    }
  });

  test('every definition has a description', () => {
    for (const td of TOOL_DEFINITIONS) {
      expect(td.description).toBeTruthy();
      expect(typeof td.description).toBe('string');
    }
  });

  test('every definition has an inputSchema', () => {
    for (const td of TOOL_DEFINITIONS) {
      expect(td.inputSchema).toBeTruthy();
      expect(td.inputSchema.type).toBe('object');
    }
  });

  test('all tool names include "form"', () => {
    for (const td of TOOL_DEFINITIONS) {
      expect(td.name).toMatch(/form/i);
    }
  });

  test('all tool names are unique', () => {
    const names = TOOL_DEFINITIONS.map((td) => td.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('all tool names use snake_case', () => {
    for (const td of TOOL_DEFINITIONS) {
      expect(td.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test('inputSchema has properties object', () => {
    for (const td of TOOL_DEFINITIONS) {
      expect(td.inputSchema.properties).toBeTruthy();
      expect(typeof td.inputSchema.properties).toBe('object');
    }
  });

  test('has at least 8 tools', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
  });
});
