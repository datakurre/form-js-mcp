/**
 * Manages the in-memory store of form schemas and exposes helpers
 * for creating / retrieving / importing forms.
 */

import { randomBytes } from 'node:crypto';
import { type FormState, type FormSchema } from './types';
import { DEFAULT_SCHEMA_VERSION, EXPORTER } from './constants';

// ── Form store ─────────────────────────────────────────────────────────────

const forms = new Map<string, FormState>();

export function getForm(id: string): FormState | undefined {
  return forms.get(id);
}

export function storeForm(id: string, state: FormState): void {
  forms.set(id, state);
}

export function deleteForm(id: string): boolean {
  return forms.delete(id);
}

export function getAllForms(): Map<string, FormState> {
  return forms;
}

export function generateFormId(): string {
  return `form_${Date.now()}_${randomBytes(6).toString('hex')}`;
}

/** Visible for testing — wipe all forms. */
export function clearForms(): void {
  forms.clear();
}

// ── Schema helpers ─────────────────────────────────────────────────────────

/** Create a fresh empty form schema. */
export function createEmptySchema(name?: string): FormSchema {
  const id = `Form_${randomBytes(4).toString('hex')}`;
  return {
    type: 'default',
    id,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    exporter: { ...EXPORTER },
    components: [],
    ...(name ? {} : {}),
  };
}
