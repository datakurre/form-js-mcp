/**
 * Form schema validation — semantic checks beyond JSON Schema.
 *
 * Checks: duplicate keys, duplicate IDs, missing keys on keyed types,
 * invalid field types, and structural issues.
 */

import { type FormSchema, type FormComponent } from './types';
import { SUPPORTED_FIELD_TYPES, KEYED_FIELD_TYPES } from './constants';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  componentId?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function checkType(comp: FormComponent, path: string): ValidationIssue | undefined {
  if (!comp.type) {
    return {
      severity: 'error',
      componentId: comp.id,
      message: `Component at ${path} is missing "type"`,
      suggestion: 'Add a valid type property',
    };
  }
  if (!(SUPPORTED_FIELD_TYPES as readonly string[]).includes(comp.type)) {
    return {
      severity: 'warning',
      componentId: comp.id,
      message: `Unknown field type "${comp.type}" on ${comp.id ?? path}`,
      suggestion: `Use one of: ${SUPPORTED_FIELD_TYPES.join(', ')}`,
    };
  }
  return undefined;
}

function checkDuplicateId(
  comp: FormComponent,
  path: string,
  seenIds: Map<string, string>
): ValidationIssue | undefined {
  if (!comp.id) return undefined;
  const existing = seenIds.get(comp.id);
  if (existing) {
    return {
      severity: 'error',
      componentId: comp.id,
      message: `Duplicate component ID "${comp.id}" (also at ${existing})`,
      suggestion: 'Each component must have a unique id',
    };
  }
  seenIds.set(comp.id, path);
  return undefined;
}

function checkKeyPresence(comp: FormComponent): ValidationIssue | undefined {
  const isKeyed = (KEYED_FIELD_TYPES as readonly string[]).includes(comp.type);
  if (isKeyed && !comp.key) {
    return {
      severity: 'error',
      componentId: comp.id,
      message: `Keyed field type "${comp.type}" at ${comp.id ?? comp.type} is missing "key"`,
      suggestion: 'Add a key property to bind this field to data',
    };
  }
  return undefined;
}

function checkDuplicateKey(
  comp: FormComponent,
  seenKeys: Map<string, string>
): ValidationIssue | undefined {
  if (!comp.key) return undefined;
  const existing = seenKeys.get(comp.key);
  if (existing) {
    return {
      severity: 'error',
      componentId: comp.id,
      message: `Duplicate key "${comp.key}" on ${comp.id ?? comp.type} (also at ${existing})`,
      suggestion: 'Each keyed component must have a unique key',
    };
  }
  seenKeys.set(comp.key, comp.id ?? comp.type);
  return undefined;
}

function walkComponents(
  components: FormComponent[],
  issues: ValidationIssue[],
  seenKeys: Map<string, string>,
  seenIds: Map<string, string>,
  parentPath: string
): void {
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const path = `${parentPath}[${i}]`;

    const typeIssue = checkType(comp, path);
    if (typeIssue) issues.push(typeIssue);

    const idIssue = checkDuplicateId(comp, path, seenIds);
    if (idIssue) issues.push(idIssue);

    const keyPresenceIssue = checkKeyPresence(comp);
    if (keyPresenceIssue) issues.push(keyPresenceIssue);

    const keyDupIssue = checkDuplicateKey(comp, seenKeys);
    if (keyDupIssue) issues.push(keyDupIssue);

    if (comp.components && Array.isArray(comp.components)) {
      walkComponents(comp.components, issues, seenKeys, seenIds, `${path}.components`);
    }
  }
}

/** Validate a form schema with semantic checks. */
export function validateFormSchema(schema: FormSchema): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seenKeys = new Map<string, string>();
  const seenIds = new Map<string, string>();

  if (!schema) {
    return { valid: false, issues: [{ severity: 'error', message: 'Schema is null/undefined' }] };
  }

  if (!Array.isArray(schema.components)) {
    issues.push({
      severity: 'error',
      message: 'Schema is missing "components" array',
      suggestion: 'Add a components array to the schema',
    });
    return { valid: false, issues };
  }

  walkComponents(schema.components, issues, seenKeys, seenIds, 'components');

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { valid: !hasErrors, issues };
}
