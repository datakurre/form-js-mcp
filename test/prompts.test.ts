import { describe, test, expect } from 'vitest';
import { listPrompts, getPrompt } from '../src/prompts';

describe('prompts', () => {
  // ── listPrompts ──────────────────────────────────────────────────────────

  describe('listPrompts', () => {
    test('returns at least 5 prompts', () => {
      const prompts = listPrompts();
      expect(prompts.length).toBeGreaterThanOrEqual(5);
    });

    test('each prompt has name and description', () => {
      for (const p of listPrompts()) {
        expect(p.name).toBeTruthy();
        expect(typeof p.name).toBe('string');
        expect(p.description).toBeTruthy();
        expect(typeof p.description).toBe('string');
      }
    });

    test('prompt names are unique', () => {
      const names = listPrompts().map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  // ── getPrompt ────────────────────────────────────────────────────────────

  describe('getPrompt', () => {
    test('create-user-task-form returns messages', () => {
      const result = getPrompt('create-user-task-form', { formName: 'Invoice' });
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(result.messages[0].content.text).toContain('Invoice');
    });

    test('create-approval-form returns messages', () => {
      const result = getPrompt('create-approval-form', { formName: 'Review' });
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[0].content.text).toContain('Review');
    });

    test('create-approval-form uses custom approval field', () => {
      const result = getPrompt('create-approval-form', {
        formName: 'Review',
        approvalField: 'decision',
      });
      expect(result.messages[1].content.text).toContain('decision');
    });

    test('add-conditional-section returns messages', () => {
      const result = getPrompt('add-conditional-section', {
        formId: 'form_123',
        triggerFieldKey: 'showDetails',
        condition: '=showDetails = false',
      });
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[1].content.text).toContain('showDetails');
    });

    test('create-multi-step-form returns messages', () => {
      const result = getPrompt('create-multi-step-form', {
        formName: 'Onboarding',
        sections: 'Personal,Address,Review',
      });
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[1].content.text).toContain('Personal');
      expect(result.messages[1].content.text).toContain('Address');
      expect(result.messages[1].content.text).toContain('Review');
    });

    test('convert-to-dynamic-list returns messages', () => {
      const result = getPrompt('convert-to-dynamic-list', {
        formId: 'form_123',
        listFieldKey: 'items',
      });
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[1].content.text).toContain('items');
    });

    test('throws for unknown prompt', () => {
      expect(() => getPrompt('nonexistent', {})).toThrow('Unknown prompt');
    });

    test('all listed prompts are callable', () => {
      for (const p of listPrompts()) {
        // Build minimal args from required arguments
        const args: Record<string, string> = {};
        for (const arg of p.arguments ?? []) {
          if (arg.required) args[arg.name] = 'test_value';
        }
        const result = getPrompt(p.name, args);
        expect(result.messages.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
