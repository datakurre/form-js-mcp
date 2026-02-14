/**
 * replace_form_component — Change a component's type while preserving compatible properties.
 */

import { type ToolResult } from '../../types';
import { KEYED_FIELD_TYPES, CONTAINER_FIELD_TYPES, OPTIONS_FIELD_TYPES } from '../../constants';
import {
  validateArgs,
  requireForm,
  requireComponent,
  isSupportedType,
  mutationResult,
  bumpVersion,
} from '../helpers';

export const TOOL_DEFINITION = {
  name: 'replace_form_component',
  description:
    "Change a component's type while preserving compatible properties " +
    '(e.g. textfield → textarea keeps key, label, validate). ' +
    'Type-specific properties that are incompatible with the new type are removed.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      componentId: { type: 'string', description: 'Component ID to replace' },
      newType: { type: 'string', description: 'New field type (e.g. "textarea", "select")' },
    },
    required: ['formId', 'componentId', 'newType'],
  },
} as const;

/**
 * Properties that are universally compatible across all field types.
 * These are always preserved during replacement.
 */
const UNIVERSAL_PROPS = new Set([
  'id',
  'type',
  'label',
  'description',
  'conditional',
  'layout',
  'properties',
]);

/**
 * Properties specific to keyed (input/selection) types.
 */
const KEYED_PROPS = new Set(['key', 'defaultValue', 'disabled', 'readonly', 'validate']);

/**
 * Properties specific to option-based types (select, radio, checklist, taglist).
 */
const OPTIONS_PROPS = new Set(['values', 'valuesKey', 'valuesExpression']);

/**
 * Properties specific to container types (group, dynamiclist).
 */
const CONTAINER_PROPS = new Set(['components']);

function isKeyed(type: string): boolean {
  return (KEYED_FIELD_TYPES as readonly string[]).includes(type);
}

function isOptions(type: string): boolean {
  return (OPTIONS_FIELD_TYPES as readonly string[]).includes(type);
}

function isContainer(type: string): boolean {
  return (CONTAINER_FIELD_TYPES as readonly string[]).includes(type);
}

export async function handleReplaceFormComponent(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'componentId', 'newType']);
  const form = requireForm(args.formId);
  const comp = requireComponent(form, args.componentId);
  const { newType } = args;

  if (!isSupportedType(newType)) {
    throw new Error(`Unsupported field type: ${newType}`);
  }

  if (comp.type === newType) {
    throw new Error(`Component "${args.componentId}" is already type "${newType}"`);
  }

  const oldType = comp.type;

  // Determine which properties to keep based on the new type
  const preserved: string[] = [];
  const removed: string[] = [];

  // Collect all current property keys (excluding 'type')
  const allKeys = Object.keys(comp).filter((k) => k !== 'type');

  for (const key of allKeys) {
    let keep = false;

    // Universal props are always kept
    if (UNIVERSAL_PROPS.has(key)) {
      keep = true;
    }
    // Keyed props only kept if new type is keyed
    else if (KEYED_PROPS.has(key)) {
      keep = isKeyed(newType);
    }
    // Options props only kept if new type is options-based
    else if (OPTIONS_PROPS.has(key)) {
      keep = isOptions(newType);
    }
    // Container props only kept if new type is a container
    else if (CONTAINER_PROPS.has(key)) {
      keep = isContainer(newType);
    }
    // Unknown/type-specific props are removed
    else {
      keep = false;
    }

    if (keep) {
      preserved.push(key);
    } else {
      removed.push(key);
      delete (comp as Record<string, unknown>)[key];
    }
  }

  // Set the new type
  comp.type = newType;

  // If the new type is keyed but the component has no key, we need to note that
  // (the validator will catch it via hints)

  bumpVersion(form);

  return mutationResult(form, {
    componentId: args.componentId,
    oldType,
    newType,
    preserved,
    removed,
    message: `Replaced "${args.componentId}" type from "${oldType}" to "${newType}"`,
  });
}
