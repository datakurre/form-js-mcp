/**
 * Prompt definitions for form-js-mcp.
 *
 * Each prompt guides an AI assistant through a multi-step form-building
 * workflow, referencing the available MCP tools.
 */

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export const PROMPT_DEFINITIONS: readonly PromptDefinition[] = [
  {
    name: 'create-user-task-form',
    description:
      'Step-by-step guide for creating a Camunda user task form with fields, validation, layout, and export.',
    arguments: [
      { name: 'formName', description: 'Name for the new form', required: true },
      { name: 'description', description: 'Brief description of the form purpose' },
    ],
  },
  {
    name: 'create-approval-form',
    description:
      'Template for creating an approval workflow form with approve/reject radio, comments, and conditional fields.',
    arguments: [
      { name: 'formName', description: 'Name for the approval form', required: true },
      {
        name: 'approvalField',
        description: 'Key for the approval decision field (default: "approved")',
      },
    ],
  },
  {
    name: 'add-conditional-section',
    description:
      'Guide for adding a group of fields that are conditionally visible based on another field value.',
    arguments: [
      { name: 'formId', description: 'The form to add the conditional section to', required: true },
      {
        name: 'triggerFieldKey',
        description: 'The key of the field that triggers visibility',
        required: true,
      },
      {
        name: 'condition',
        description: 'FEEL expression for when the section should be hidden',
        required: true,
      },
    ],
  },
  {
    name: 'create-multi-step-form',
    description:
      'Guide for creating a multi-section form using groups, with one group per logical step.',
    arguments: [
      { name: 'formName', description: 'Name for the form', required: true },
      {
        name: 'sections',
        description: 'Comma-separated section names (e.g. "Personal,Address,Review")',
        required: true,
      },
    ],
  },
  {
    name: 'convert-to-dynamic-list',
    description: 'Guide for wrapping fields in a dynamiclist to create repeatable form sections.',
    arguments: [
      { name: 'formId', description: 'The form to modify', required: true },
      {
        name: 'listFieldKey',
        description: 'The data binding key for the dynamic list',
        required: true,
      },
    ],
  },
] as const;
