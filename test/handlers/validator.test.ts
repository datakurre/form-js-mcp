import { describe, test, expect } from 'vitest';
import { validateFormSchema } from '../../src/validator';
import { type FormSchema } from '../../src/types';

describe('validator', () => {
  test('valid empty form', () => {
    const schema: FormSchema = { type: 'default', components: [] };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('valid form with components', () => {
    const schema: FormSchema = {
      type: 'default',
      components: [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'number', id: 'b', key: 'age' },
        { type: 'text', id: 'c' },
      ],
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(true);
  });

  test('detects duplicate IDs', () => {
    const schema: FormSchema = {
      type: 'default',
      components: [
        { type: 'textfield', id: 'dup', key: 'a' },
        { type: 'number', id: 'dup', key: 'b' },
      ],
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('Duplicate component ID'))).toBe(true);
  });

  test('detects duplicate keys', () => {
    const schema: FormSchema = {
      type: 'default',
      components: [
        { type: 'textfield', id: 'a', key: 'name' },
        { type: 'textfield', id: 'b', key: 'name' },
      ],
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('Duplicate key'))).toBe(true);
  });

  test('detects missing key on keyed type', () => {
    const schema: FormSchema = {
      type: 'default',
      components: [{ type: 'textfield', id: 'a' }],
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('missing "key"'))).toBe(true);
  });

  test('warns on unknown field type', () => {
    const schema: FormSchema = {
      type: 'default',
      components: [{ type: 'fancywidget', id: 'a' }],
    };
    const result = validateFormSchema(schema);
    // Warnings do not make valid=false
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.severity === 'warning')).toBe(true);
  });

  test('detects missing components array', () => {
    const result = validateFormSchema({ type: 'default' } as any);
    expect(result.valid).toBe(false);
  });

  test('validates nested components', () => {
    const schema: FormSchema = {
      type: 'default',
      components: [
        {
          type: 'group',
          id: 'g1',
          components: [
            { type: 'textfield', id: 'a', key: 'name' },
            { type: 'textfield', id: 'a', key: 'other' }, // duplicate ID
          ],
        },
      ],
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
  });
});
