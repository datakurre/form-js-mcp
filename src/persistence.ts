/**
 * Optional file-backed persistence for form schemas.
 *
 * When enabled via `enablePersistence(dir)`, forms are saved as `.form`
 * JSON files alongside a `meta.json` manifest. On startup, existing
 * `.form` files are loaded back into memory.
 *
 * File layout inside the persistence directory:
 *   <dir>/
 *     meta.json            — { forms: { [formId]: { name?, file } } }
 *     <formId>.form        — JSON schema
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { type FormState, type FormSchema } from './types';
import { storeForm, setFormChangeListener } from './form-manager';

// ── State ──────────────────────────────────────────────────────────────────

let persistDir: string | undefined;

// ── Public API ─────────────────────────────────────────────────────────────

/** Check whether file persistence is currently enabled. */
export function isPersistenceEnabled(): boolean {
  return persistDir !== undefined;
}

/** Return the active persistence directory, or undefined. */
export function getPersistDir(): string | undefined {
  return persistDir;
}

/**
 * Enable file-backed persistence in `dir`.
 *
 * - Creates `dir` if it does not exist.
 * - Loads any existing `.form` files into the in-memory store.
 * - Registers a form-manager change listener for auto-save.
 *
 * @returns The number of forms loaded from disk.
 */
export function enablePersistence(dir: string): number {
  const absDir = resolve(dir);
  mkdirSync(absDir, { recursive: true });
  persistDir = absDir;

  // Register the auto-persist hook
  setFormChangeListener(onFormChange);

  // Load existing forms
  return loadForms(absDir);
}

/** Disable file-backed persistence and remove the change listener. */
export function disablePersistence(): void {
  persistDir = undefined;
  setFormChangeListener(undefined);
}

// ── Persist a single form ──────────────────────────────────────────────────

/**
 * Write a form's schema to disk as `<formId>.form`.
 * After writing, re-reads and verifies the JSON is parseable.
 */
export function persistForm(formId: string, form: FormState): void {
  if (!persistDir) return;

  const filePath = formFilePath(persistDir, formId);
  const json = JSON.stringify(form.schema, null, 2);
  writeFileSync(filePath, json, 'utf-8');

  // Post-write validation: re-read and verify JSON is parseable
  const raw = readFileSync(filePath, 'utf-8');
  JSON.parse(raw); // throws on corruption

  // Update meta.json
  writeMeta(persistDir, formId, form.name);
}

/** Remove a persisted form file and its meta entry. */
export function deletePersistedForm(formId: string): void {
  if (!persistDir) return;

  const filePath = formFilePath(persistDir, formId);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
  removeMeta(persistDir, formId);
}

// ── Load forms from disk ───────────────────────────────────────────────────

/**
 * Read all `.form` files from `dir` and import them into the in-memory
 * store. Returns the number of forms successfully loaded.
 */
export function loadForms(dir: string): number {
  if (!existsSync(dir)) return 0;

  const meta = readMeta(dir);
  let loaded = 0;

  // Load from meta entries first (preserves formId → file mapping)
  if (meta && typeof meta.forms === 'object') {
    for (const [formId, entry] of Object.entries(meta.forms) as Array<
      [string, { name?: string; file: string }]
    >) {
      const filePath = join(dir, entry.file);
      if (!existsSync(filePath)) continue;

      const schema = tryReadFormFile(filePath);
      if (!schema) continue;

      storeForm(formId, { schema, name: entry.name, version: 0 });
      loaded++;
    }
    return loaded;
  }

  // Fallback: scan for .form files when no meta.json exists
  const files = readdirSync(dir).filter((f) => f.endsWith('.form'));
  for (const file of files) {
    const filePath = join(dir, file);
    const schema = tryReadFormFile(filePath);
    if (!schema) continue;

    const formId = file.replace(/\.form$/, '');
    const name = schema.id ?? formId;
    storeForm(formId, { schema, name, version: 0 });
    loaded++;
  }

  return loaded;
}

// ── Change listener (auto-save hook) ───────────────────────────────────────

function onFormChange(event: 'store' | 'delete', formId: string, form?: FormState): void {
  if (!persistDir) return;

  if (event === 'store' && form) {
    persistForm(formId, form);
  } else if (event === 'delete') {
    deletePersistedForm(formId);
  }
}

// ── Meta.json helpers ──────────────────────────────────────────────────────

interface MetaJson {
  forms: Record<string, { name?: string; file: string }>;
}

function metaPath(dir: string): string {
  return join(dir, 'meta.json');
}

function readMeta(dir: string): MetaJson | undefined {
  const path = metaPath(dir);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return undefined;
  }
}

function writeMeta(dir: string, formId: string, name?: string): void {
  const meta = readMeta(dir) ?? { forms: {} };
  meta.forms[formId] = { name, file: `${formId}.form` };
  writeFileSync(metaPath(dir), JSON.stringify(meta, null, 2), 'utf-8');
}

function removeMeta(dir: string, formId: string): void {
  const meta = readMeta(dir);
  if (!meta) return;
  delete meta.forms[formId];
  writeFileSync(metaPath(dir), JSON.stringify(meta, null, 2), 'utf-8');
}

// ── File helpers ───────────────────────────────────────────────────────────

function formFilePath(dir: string, formId: string): string {
  return join(dir, `${formId}.form`);
}

/** Attempt to read and parse a .form file. Returns undefined on failure. */
function tryReadFormFile(filePath: string): FormSchema | undefined {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const schema = JSON.parse(raw);
    if (!schema || typeof schema !== 'object' || !Array.isArray(schema.components)) {
      return undefined;
    }
    schema.type = schema.type ?? 'default';
    return schema as FormSchema;
  } catch {
    return undefined;
  }
}
