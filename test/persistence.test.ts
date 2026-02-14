/**
 * Tests for file-backed persistence (P7.4 / P10.6).
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import {
  enablePersistence,
  disablePersistence,
  isPersistenceEnabled,
  getPersistDir,
  persistForm,
  deletePersistedForm,
  loadForms,
} from '../src/persistence';
import {
  clearForms as clearStore,
  storeForm,
  deleteForm,
  getForm,
  createEmptySchema,
  generateFormId,
} from '../src/form-manager';

/** Create a fresh temporary directory for each test. */
function makeTmpDir(): string {
  const dir = join(tmpdir(), `form-js-mcp-test-${randomBytes(6).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('persistence', () => {
  let tmpDir: string;

  beforeEach(() => {
    clearStore();
    disablePersistence();
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    disablePersistence();
    clearStore();
    // Clean up temp dir
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── Enable / disable ────────────────────────────────────────────────────

  describe('enablePersistence / disablePersistence', () => {
    test('isPersistenceEnabled returns false by default', () => {
      expect(isPersistenceEnabled()).toBe(false);
      expect(getPersistDir()).toBeUndefined();
    });

    test('enablePersistence creates directory and sets state', () => {
      const dir = join(tmpDir, 'sub', 'forms');
      const loaded = enablePersistence(dir);
      expect(loaded).toBe(0);
      expect(isPersistenceEnabled()).toBe(true);
      expect(getPersistDir()).toBe(dir);
      expect(existsSync(dir)).toBe(true);
    });

    test('disablePersistence clears state', () => {
      enablePersistence(tmpDir);
      expect(isPersistenceEnabled()).toBe(true);
      disablePersistence();
      expect(isPersistenceEnabled()).toBe(false);
      expect(getPersistDir()).toBeUndefined();
    });
  });

  // ── persistForm / deletePersistedForm ────────────────────────────────────

  describe('persistForm', () => {
    test('writes .form file and meta.json', () => {
      enablePersistence(tmpDir);
      const schema = createEmptySchema('Test');
      const formId = 'test_form_1';

      persistForm(formId, { schema, name: 'Test', version: 1 });

      // Check .form file exists and is valid JSON
      const formPath = join(tmpDir, `${formId}.form`);
      expect(existsSync(formPath)).toBe(true);
      const parsed = JSON.parse(readFileSync(formPath, 'utf-8'));
      expect(parsed.type).toBe('default');
      expect(parsed.components).toEqual([]);

      // Check meta.json
      const metaPath = join(tmpDir, 'meta.json');
      expect(existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      expect(meta.forms[formId]).toBeDefined();
      expect(meta.forms[formId].file).toBe(`${formId}.form`);
      expect(meta.forms[formId].name).toBe('Test');
    });

    test('does nothing when persistence is disabled', () => {
      const schema = createEmptySchema();
      persistForm('test_id', { schema, version: 0 });

      const formPath = join(tmpDir, 'test_id.form');
      expect(existsSync(formPath)).toBe(false);
    });
  });

  describe('deletePersistedForm', () => {
    test('removes .form file and meta entry', () => {
      enablePersistence(tmpDir);
      const formId = 'test_delete';
      const schema = createEmptySchema();
      persistForm(formId, { schema, version: 0 });

      expect(existsSync(join(tmpDir, `${formId}.form`))).toBe(true);

      deletePersistedForm(formId);
      expect(existsSync(join(tmpDir, `${formId}.form`))).toBe(false);

      // meta.json should no longer have the entry
      const meta = JSON.parse(readFileSync(join(tmpDir, 'meta.json'), 'utf-8'));
      expect(meta.forms[formId]).toBeUndefined();
    });

    test('does nothing when persistence is disabled', () => {
      // Should not throw
      deletePersistedForm('nonexistent');
    });

    test('handles non-existent file gracefully', () => {
      enablePersistence(tmpDir);
      // Should not throw even if file doesn't exist
      deletePersistedForm('ghost_form');
    });
  });

  // ── loadForms ────────────────────────────────────────────────────────────

  describe('loadForms', () => {
    test('loads forms from meta.json', () => {
      // Write form file and meta.json manually
      const formId = 'load_test_1';
      const schema = createEmptySchema('Loaded Form');
      writeFileSync(join(tmpDir, `${formId}.form`), JSON.stringify(schema), 'utf-8');
      writeFileSync(
        join(tmpDir, 'meta.json'),
        JSON.stringify({ forms: { [formId]: { name: 'Loaded Form', file: `${formId}.form` } } }),
        'utf-8'
      );

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(1);

      const form = getForm(formId);
      expect(form).toBeDefined();
      expect(form!.name).toBe('Loaded Form');
      expect(form!.schema.components).toEqual([]);
    });

    test('falls back to scanning .form files when no meta.json', () => {
      const schema = createEmptySchema('Scan Test');
      writeFileSync(join(tmpDir, 'scan_form.form'), JSON.stringify(schema), 'utf-8');

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(1);

      const form = getForm('scan_form');
      expect(form).toBeDefined();
    });

    test('returns 0 for non-existent directory', () => {
      expect(loadForms('/tmp/nonexistent_dir_12345')).toBe(0);
    });

    test('skips invalid .form files', () => {
      writeFileSync(join(tmpDir, 'bad.form'), 'not json {{{', 'utf-8');
      writeFileSync(join(tmpDir, 'good.form'), JSON.stringify(createEmptySchema()), 'utf-8');

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(1);
    });

    test('skips files missing components array', () => {
      writeFileSync(join(tmpDir, 'nocomp.form'), JSON.stringify({ type: 'default' }), 'utf-8');

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(0);
    });
  });

  // ── Round-trip (write → read) ────────────────────────────────────────────

  describe('round-trip', () => {
    test('persist then load restores form', () => {
      enablePersistence(tmpDir);

      const formId = generateFormId();
      const schema = createEmptySchema('Round Trip');
      schema.components = [
        { type: 'textfield', id: 'Field_1', key: 'name', label: 'Name' },
        { type: 'number', id: 'Field_2', key: 'age', label: 'Age' },
      ];

      persistForm(formId, { schema, name: 'Round Trip', version: 3 });

      // Clear in-memory store
      clearStore();
      disablePersistence();

      // Reload
      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(1);

      const restored = getForm(formId);
      expect(restored).toBeDefined();
      expect(restored!.name).toBe('Round Trip');
      expect(restored!.schema.components).toHaveLength(2);
      expect(restored!.schema.components[0].key).toBe('name');
      expect(restored!.schema.components[1].key).toBe('age');
    });

    test('multiple forms survive round-trip', () => {
      enablePersistence(tmpDir);

      const id1 = 'form_rt_1';
      const id2 = 'form_rt_2';
      const s1 = createEmptySchema('Form A');
      const s2 = createEmptySchema('Form B');
      s1.components = [{ type: 'textfield', id: 'F1', key: 'x', label: 'X' }];
      s2.components = [{ type: 'checkbox', id: 'F2', key: 'y', label: 'Y' }];

      persistForm(id1, { schema: s1, name: 'Form A', version: 1 });
      persistForm(id2, { schema: s2, name: 'Form B', version: 2 });

      clearStore();
      disablePersistence();

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(2);
      expect(getForm(id1)!.schema.components[0].type).toBe('textfield');
      expect(getForm(id2)!.schema.components[0].type).toBe('checkbox');
    });
  });

  // ── Auto-persist via change listener ─────────────────────────────────────

  describe('auto-persist via form-manager hooks', () => {
    test('storeForm auto-persists when persistence is enabled', () => {
      enablePersistence(tmpDir);

      const formId = 'auto_store';
      const schema = createEmptySchema('Auto');
      storeForm(formId, { schema, name: 'Auto', version: 0 });

      // Check file was written
      const filePath = join(tmpDir, `${formId}.form`);
      expect(existsSync(filePath)).toBe(true);
      const persisted = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(persisted.type).toBe('default');
    });

    test('deleteForm auto-removes file when persistence is enabled', () => {
      enablePersistence(tmpDir);

      const formId = 'auto_delete';
      const schema = createEmptySchema();
      storeForm(formId, { schema, version: 0 });

      expect(existsSync(join(tmpDir, `${formId}.form`))).toBe(true);

      deleteForm(formId);
      expect(existsSync(join(tmpDir, `${formId}.form`))).toBe(false);
    });

    test('enablePersistence loads existing forms from disk', () => {
      // Pre-populate the dir
      const formId = 'preexist';
      const schema = createEmptySchema('Pre-existing');
      writeFileSync(join(tmpDir, `${formId}.form`), JSON.stringify(schema), 'utf-8');
      writeFileSync(
        join(tmpDir, 'meta.json'),
        JSON.stringify({ forms: { [formId]: { name: 'Pre-existing', file: `${formId}.form` } } }),
        'utf-8'
      );

      const loaded = enablePersistence(tmpDir);
      expect(loaded).toBe(1);
      expect(getForm(formId)).toBeDefined();
    });
  });

  // ── Corruption handling ──────────────────────────────────────────────────

  describe('corruption handling', () => {
    test('loadForms skips corrupted .form files', () => {
      writeFileSync(join(tmpDir, 'corrupt.form'), '{invalid json...', 'utf-8');
      writeFileSync(join(tmpDir, 'valid.form'), JSON.stringify(createEmptySchema()), 'utf-8');

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(1); // Only valid form loaded
    });

    test('loadForms skips meta entries pointing to missing files', () => {
      writeFileSync(
        join(tmpDir, 'meta.json'),
        JSON.stringify({
          forms: { ghost: { name: 'Ghost', file: 'ghost.form' } },
        }),
        'utf-8'
      );

      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(0);
    });

    test('loadForms handles corrupted meta.json gracefully', () => {
      writeFileSync(join(tmpDir, 'meta.json'), 'not json!!!', 'utf-8');
      writeFileSync(join(tmpDir, 'fallback.form'), JSON.stringify(createEmptySchema()), 'utf-8');

      // Should fall back to scanning .form files
      const loaded = loadForms(tmpDir);
      expect(loaded).toBe(1);
    });
  });
});
