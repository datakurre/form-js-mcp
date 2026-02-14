/**
 * Manages the in-memory store of form schemas and exposes helpers
 * for creating / retrieving / importing forms.
 */

import { randomBytes } from 'node:crypto';
import { type FormState, type FormSchema } from './types';
import { DEFAULT_SCHEMA_VERSION, EXPORTER } from './constants';

// ── Change listener (used by persistence) ──────────────────────────────────

type FormChangeListener = (event: 'store' | 'delete', formId: string, form?: FormState) => void;
let changeListener: FormChangeListener | undefined;

/** Register a listener called on every store / delete / notify. */
export function setFormChangeListener(listener: FormChangeListener | undefined): void {
  changeListener = listener;
}

// ── Form store ─────────────────────────────────────────────────────────────

const forms = new Map<string, FormState>();

export function getForm(id: string): FormState | undefined {
  return forms.get(id);
}

export function storeForm(id: string, state: FormState): void {
  forms.set(id, state);
  changeListener?.('store', id, state);
}

export function deleteForm(id: string): boolean {
  const existed = forms.delete(id);
  if (existed) changeListener?.('delete', id);
  return existed;
}

export function getAllForms(): Map<string, FormState> {
  return forms;
}

export function generateFormId(): string {
  return `form_${Date.now()}_${randomBytes(6).toString('hex')}`;
}

/**
 * Notify the change listener that a form was mutated in-place.
 * Call this after any in-place schema modification (e.g. after bumpVersion).
 */
export function notifyFormChanged(formId: string): void {
  if (!changeListener) return;
  const form = forms.get(formId);
  if (form) changeListener('store', formId, form);
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
