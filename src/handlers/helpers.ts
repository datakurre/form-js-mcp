/**
 * Shared handler utilities.
 */

import { randomBytes } from 'node:crypto';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getForm } from '../form-manager';
import { type FormState, type FormComponent, type ToolResult } from '../types';
import { KEYED_FIELD_TYPES, SUPPORTED_FIELD_TYPES } from '../constants';

// ── Argument validation ────────────────────────────────────────────────────

/**
 * Validate that required arguments are present.
 * Throws McpError with InvalidParams if any are missing.
 */
export function validateArgs(args: any, required: string[]): void {
  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');
  }
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      throw new McpError(ErrorCode.InvalidParams, `Missing required argument: ${field}`);
    }
  }
}

// ── Form access ────────────────────────────────────────────────────────────

/** Fetch a form or throw McpError if not found. */
export function requireForm(formId: string): FormState {
  const form = getForm(formId);
  if (!form) {
    throw new McpError(ErrorCode.InvalidParams, `Form not found: ${formId}`);
  }
  return form;
}

// ── Component lookup (recursive) ───────────────────────────────────────────

/** Find a component by ID anywhere in the schema tree. */
export function findComponentById(
  components: FormComponent[],
  id: string
): FormComponent | undefined {
  for (const comp of components) {
    if (comp.id === id) return comp;
    if (comp.components) {
      const found = findComponentById(comp.components, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Find a component by key anywhere in the schema tree. */
export function findComponentByKey(
  components: FormComponent[],
  key: string
): FormComponent | undefined {
  for (const comp of components) {
    if (comp.key === key) return comp;
    if (comp.components) {
      const found = findComponentByKey(comp.components, key);
      if (found) return found;
    }
  }
  return undefined;
}

/** Find the parent components array that contains a given component ID. */
export function findParentComponents(
  components: FormComponent[],
  id: string
): FormComponent[] | undefined {
  for (const comp of components) {
    if (comp.id === id) return components;
    if (comp.components) {
      const found = findParentComponents(comp.components, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Require a component by ID or throw. */
export function requireComponent(form: FormState, componentId: string): FormComponent {
  const comp = findComponentById(form.schema.components, componentId);
  if (!comp) {
    throw new McpError(ErrorCode.InvalidParams, `Component not found: ${componentId}`);
  }
  return comp;
}

// ── Version tracking ───────────────────────────────────────────────────────

/** Bump the mutation version counter on a form. */
export function bumpVersion(form: FormState): void {
  form.version = (form.version ?? 0) + 1;
}

// ── Response helpers ───────────────────────────────────────────────────────

/** Create a standard text ToolResult. */
export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

/** Create a standard JSON ToolResult. */
export function jsonResult(data: any): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// ── ID generation ──────────────────────────────────────────────────────────

/** Generate a component ID from type and optional label. */
export function generateComponentId(type: string, label?: string): string {
  const prefix = type.charAt(0).toUpperCase() + type.slice(1);
  const suffix = randomBytes(4).toString('hex');
  if (label) {
    const clean = label.replaceAll(/[^\w]/g, '').slice(0, 20);
    if (clean.length > 0) return `${prefix}_${clean}_${suffix}`;
  }
  return `${prefix}_${suffix}`;
}

// ── Type checks ────────────────────────────────────────────────────────────

/** Check if a field type is keyed (binds to a data variable). */
export function isKeyedType(type: string): boolean {
  return (KEYED_FIELD_TYPES as readonly string[]).includes(type);
}

/** Check if a field type is supported. */
export function isSupportedType(type: string): boolean {
  return (SUPPORTED_FIELD_TYPES as readonly string[]).includes(type);
}

// ── Key collection ─────────────────────────────────────────────────────────

/** Collect all keys from a component tree. */
export function collectAllKeys(components: FormComponent[]): string[] {
  const keys: string[] = [];
  for (const comp of components) {
    if (comp.key) keys.push(comp.key);
    if (comp.components) keys.push(...collectAllKeys(comp.components));
  }
  return keys;
}

/** Collect all IDs from a component tree. */
export function collectAllIds(components: FormComponent[]): string[] {
  const ids: string[] = [];
  for (const comp of components) {
    if (comp.id) ids.push(comp.id);
    if (comp.components) ids.push(...collectAllIds(comp.components));
  }
  return ids;
}

/** Count components recursively. */
export function countComponents(components: FormComponent[]): number {
  let count = 0;
  for (const comp of components) {
    count++;
    if (comp.components) count += countComponents(comp.components);
  }
  return count;
}
