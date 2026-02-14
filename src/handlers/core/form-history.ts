/**
 * form_history — Undo/redo for form schemas via version snapshots.
 */

import { type ToolResult, type FormSchema } from '../../types';
import { validateArgs, requireForm, jsonResult, countComponents } from '../helpers';

export const TOOL_DEFINITION = {
  name: 'form_history',
  description:
    'Undo or redo changes to a form schema. Each mutation is automatically ' +
    'tracked. Use action "undo" to revert to the previous state or "redo" to re-apply.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'Target form ID' },
      action: {
        type: 'string',
        enum: ['undo', 'redo'],
        description: 'History action to perform',
      },
    },
    required: ['formId', 'action'],
  },
} as const;

// ── History storage ────────────────────────────────────────────────────────

interface HistoryEntry {
  undoStack: FormSchema[];
  redoStack: FormSchema[];
}

const historyStore = new Map<string, HistoryEntry>();

/** Maximum number of snapshots to keep per form. */
const MAX_HISTORY = 50;

/** Get or create history entry for a form. */
function getHistory(formId: string): HistoryEntry {
  let entry = historyStore.get(formId);
  if (!entry) {
    entry = { undoStack: [], redoStack: [] };
    historyStore.set(formId, entry);
  }
  return entry;
}

/**
 * Record a snapshot of the current schema before a mutation.
 * Should be called by the MCP server or a wrapper before mutations.
 * For now, we push the current state onto the undo stack when undo is first requested.
 */
export function pushSnapshot(formId: string, schema: FormSchema): void {
  const history = getHistory(formId);
  history.undoStack.push(JSON.parse(JSON.stringify(schema)));
  if (history.undoStack.length > MAX_HISTORY) {
    history.undoStack.shift();
  }
  // Clear redo stack on new mutation
  history.redoStack.length = 0;
}

/** Clear history for a form (e.g. on delete). */
export function clearHistory(formId: string): void {
  historyStore.delete(formId);
}

/** Clear all history (for testing). */
export function clearAllHistory(): void {
  historyStore.clear();
}

/** Get history stack sizes (for testing/debugging). */
export function getHistorySize(formId: string): { undoCount: number; redoCount: number } {
  const history = historyStore.get(formId);
  return {
    undoCount: history?.undoStack.length ?? 0,
    redoCount: history?.redoStack.length ?? 0,
  };
}

export async function handleFormHistory(args: any): Promise<ToolResult> {
  validateArgs(args, ['formId', 'action']);
  const form = requireForm(args.formId);
  const { action } = args;

  if (action !== 'undo' && action !== 'redo') {
    throw new Error(`Invalid action: ${action}. Use "undo" or "redo".`);
  }

  const history = getHistory(args.formId);

  if (action === 'undo') {
    if (history.undoStack.length === 0) {
      throw new Error('Nothing to undo');
    }

    // Save current state to redo stack
    history.redoStack.push(JSON.parse(JSON.stringify(form.schema)));

    // Restore previous state
    const previous = history.undoStack.pop()!;
    form.schema = previous;
    form.version = (form.version ?? 0) + 1;

    return jsonResult({
      action: 'undo',
      formId: args.formId,
      componentCount: countComponents(form.schema.components),
      undoRemaining: history.undoStack.length,
      redoAvailable: history.redoStack.length,
      message: 'Undid last change',
    });
  }

  // redo
  if (history.redoStack.length === 0) {
    throw new Error('Nothing to redo');
  }

  // Save current state to undo stack
  history.undoStack.push(JSON.parse(JSON.stringify(form.schema)));

  // Restore next state
  const next = history.redoStack.pop()!;
  form.schema = next;
  form.version = (form.version ?? 0) + 1;

  return jsonResult({
    action: 'redo',
    formId: args.formId,
    componentCount: countComponents(form.schema.components),
    undoRemaining: history.undoStack.length,
    redoAvailable: history.redoStack.length,
    message: 'Redid last change',
  });
}
