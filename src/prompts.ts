/**
 * MCP prompt implementations for form-js-mcp.
 *
 * Each prompt returns an array of MCP messages that guide the AI assistant
 * through a multi-step form-building workflow.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { PROMPT_DEFINITIONS, type PromptDefinition } from './prompt-definitions';

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

export interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

// ── Public API ─────────────────────────────────────────────────────────────

/** List all available prompt definitions. */
export function listPrompts(): readonly PromptDefinition[] {
  return PROMPT_DEFINITIONS;
}

/** Get a prompt by name with the given arguments. */
export function getPrompt(name: string, args: Record<string, string>): PromptResult {
  const handler = promptHandlers[name];
  if (!handler) {
    throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  }
  return handler(args);
}

// ── Prompt handlers ────────────────────────────────────────────────────────

type PromptHandler = (args: Record<string, string>) => PromptResult;

const promptHandlers: Record<string, PromptHandler> = {
  'create-user-task-form': handleCreateUserTaskForm,
  'create-approval-form': handleCreateApprovalForm,
  'add-conditional-section': handleAddConditionalSection,
  'create-multi-step-form': handleCreateMultiStepForm,
  'convert-to-dynamic-list': handleConvertToDynamicList,
};

// ── P6.2: create-user-task-form ────────────────────────────────────────────

function handleCreateUserTaskForm(args: Record<string, string>): PromptResult {
  const formName = args.formName ?? 'New Form';
  const description = args.description ?? 'a Camunda user task form';

  return {
    description: `Create ${description}`,
    messages: [
      userMsg(
        `I need to create a Camunda user task form called "${formName}". ` +
          (args.description ? `Purpose: ${args.description}. ` : '') +
          'Please guide me through the process step by step.'
      ),
      assistantMsg(
        `I'll help you create the "${formName}" user task form. Here's the plan:\n\n` +
          '1. **Create the form** — `create_form` with Camunda Cloud platform\n' +
          '2. **Add fields with validation & layout** — `add_form_component` with the `properties` bag for validate, layout, conditional, etc. in a single call per field\n' +
          '3. **Inspect** — `inspect_form` to check for validation issues\n' +
          '4. **Export** — `export_form` to get the final JSON schema\n\n' +
          `Let's start by creating the form:\n\n` +
          '```\n' +
          `create_form({ name: "${formName}", executionPlatform: "Camunda Cloud", executionPlatformVersion: "8.8.0" })\n` +
          '```\n\n' +
          "After creating the form, tell me what fields you need and I'll add them with validation and layout in a single call per field."
      ),
    ],
  };
}

// ── P6.3: create-approval-form ─────────────────────────────────────────────

function handleCreateApprovalForm(args: Record<string, string>): PromptResult {
  const formName = args.formName ?? 'Approval Form';
  const approvalField = args.approvalField ?? 'approved';

  return {
    description: `Create an approval form: ${formName}`,
    messages: [
      userMsg(
        `Create an approval workflow form called "${formName}" with an approve/reject ` +
          `decision, a comments field, and fields that appear conditionally based on the decision.`
      ),
      assistantMsg(
        `I'll create the "${formName}" approval form with these components:\n\n` +
          '**Step 1: Create the form**\n' +
          `\`create_form({ name: "${formName}", executionPlatform: "Camunda Cloud" })\`\n\n` +
          '**Step 2: Add the approval decision radio (with options and validation)**\n' +
          `\`add_form_component({ type: "radio", key: "${approvalField}", label: "Decision", properties: { values: [{ label: "Approve", value: "approve" }, { label: "Reject", value: "reject" }], validate: { required: true } } })\`\n\n` +
          '**Step 3: Add comments textarea**\n' +
          `\`add_form_component({ type: "textarea", key: "comments", label: "Comments" })\`\n\n` +
          '**Step 4: Add conditional rejection reason (with conditional + validation)**\n' +
          `\`add_form_component({ type: "textarea", key: "rejectionReason", label: "Rejection Reason", properties: { conditional: { hide: "=${approvalField} != \\"reject\\"" }, validate: { required: true } } })\`\n\n` +
          '**Step 5: Validate and export**\n' +
          `\`inspect_form({ include: ["validation"] })\` → \`export_form({})\`\n\n` +
          `The rejection reason field will only appear when "${approvalField}" is set to "reject".`
      ),
    ],
  };
}

// ── P6.4: add-conditional-section ──────────────────────────────────────────

function handleAddConditionalSection(args: Record<string, string>): PromptResult {
  const { formId, triggerFieldKey, condition } = args;

  return {
    description: `Add a conditional section to form ${formId}`,
    messages: [
      userMsg(
        `Add a conditionally visible section to form "${formId}" that is controlled ` +
          `by the field "${triggerFieldKey}" with condition: ${condition}`
      ),
      assistantMsg(
        `I'll add a conditional group to form "${formId}":\n\n` +
          '**Step 1: Add a group container with conditional visibility**\n' +
          `\`add_form_component({ formId: "${formId}", type: "group", label: "Conditional Section", properties: { conditional: { hide: "${condition}" } } })\`\n\n` +
          '**Step 2: Add fields inside the group**\n' +
          `\`add_form_component({ formId: "${formId}", type: "textfield", parentId: <groupId>, label: "..." })\`\n\n` +
          `The group and all its children will be hidden when \`${triggerFieldKey}\` ` +
          `matches the condition \`${condition}\`.\n\n` +
          "**Tip:** Fields inside a conditional group inherit the group's visibility — " +
          "you don't need to set conditions on individual fields."
      ),
    ],
  };
}

// ── P6.5: create-multi-step-form ───────────────────────────────────────────

function handleCreateMultiStepForm(args: Record<string, string>): PromptResult {
  const formName = args.formName ?? 'Multi-Step Form';
  const sections = (args.sections ?? 'Section 1,Section 2').split(',').map((s) => s.trim());

  const sectionSteps = sections
    .map(
      (name, i) =>
        `**Group ${i + 1}: "${name}"**\n` +
        `\`add_form_component({ type: "group", label: "${name}" })\`\n` +
        `Then add fields inside using \`parentId: <groupId>\``
    )
    .join('\n\n');

  return {
    description: `Create a multi-section form: ${formName}`,
    messages: [
      userMsg(
        `Create a form called "${formName}" with the following sections: ${sections.join(', ')}. ` +
          'Each section should be a group container.'
      ),
      assistantMsg(
        `I'll create "${formName}" with ${sections.length} sections using group containers:\n\n` +
          '**Step 1: Create the form**\n' +
          `\`create_form({ name: "${formName}" })\`\n\n` +
          '**Step 2: Add section groups**\n\n' +
          sectionSteps +
          '\n\n' +
          '**Step 3: Validate and export**\n' +
          `\`inspect_form({ include: ["validation"] })\` → \`export_form({})\`\n\n` +
          'Each group acts as a logical section. You can add fields to each group ' +
          'and use `set_form_component_properties` with `layout` to control column widths within sections.'
      ),
    ],
  };
}

// ── P6.6: convert-to-dynamic-list ──────────────────────────────────────────

function handleConvertToDynamicList(args: Record<string, string>): PromptResult {
  const { formId, listFieldKey } = args;

  return {
    description: `Convert fields to a dynamic list in form ${formId}`,
    messages: [
      userMsg(
        `I want to create a repeatable section in form "${formId}" ` +
          `using a dynamiclist bound to "${listFieldKey}".`
      ),
      assistantMsg(
        `I'll help you create a dynamic (repeatable) list in form "${formId}":\n\n` +
          '**Step 1: Add the dynamiclist container**\n' +
          `\`add_form_component({ formId: "${formId}", type: "dynamiclist", key: "${listFieldKey}", label: "Items" })\`\n\n` +
          '**Step 2: Add fields inside the dynamiclist**\n' +
          `\`add_form_component({ formId: "${formId}", type: "textfield", parentId: <dynamiclistId>, label: "Item Name" })\`\n` +
          `\`add_form_component({ formId: "${formId}", type: "number", parentId: <dynamiclistId>, label: "Quantity" })\`\n\n` +
          '**Step 3: Validate**\n' +
          `\`inspect_form({ formId: "${formId}", include: ["validation"] })\`\n\n` +
          `The dynamiclist creates a repeatable row. Each time the user clicks "Add", ` +
          `a new set of the inner fields appears. The data is bound to the "${listFieldKey}" ` +
          `variable as an array of objects.\n\n` +
          '**Tip:** You can move existing fields into the dynamiclist using ' +
          '`modify_form_component` with `action: "move"` and `targetParentId` set to the dynamiclist ID.'
      ),
    ],
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function userMsg(text: string): PromptMessage {
  return { role: 'user', content: { type: 'text', text } };
}

function assistantMsg(text: string): PromptMessage {
  return { role: 'assistant', content: { type: 'text', text } };
}
