import { describe, test, expect, beforeEach } from 'vitest';
import { clearForms, createForm, parseResult } from './helpers';
import { formModule } from '../src/form-module';

describe('form-module', () => {
  beforeEach(() => {
    clearForms();
  });

  test('module name is "form"', () => {
    expect(formModule.name).toBe('form');
  });

  test('has tool definitions', () => {
    expect(formModule.toolDefinitions.length).toBeGreaterThan(0);
  });

  test('dispatch returns undefined for unknown tool', () => {
    const result = formModule.dispatch('unknown_tool', {});
    expect(result).toBeUndefined();
  });

  test('dispatch routes create_form', async () => {
    const result = await formModule.dispatch('create_form', { name: 'Test' });
    expect(result).toBeDefined();
    const data = parseResult(result!);
    expect(data.formId).toMatch(/^form_/);
    expect(data.schema.type).toBe('default');
  });

  test('dispatch routes list_forms', async () => {
    createForm('A');
    const result = await formModule.dispatch('list_forms', {});
    expect(result).toBeDefined();
    const data = parseResult(result!);
    expect(data.count).toBe(1);
  });
});
