# form-js-mcp

MCP server that lets AI assistants create and manipulate JSON-based forms using [@bpmn-io/form-js](https://github.com/bpmn-io/form-js).

Forms are managed as pure JSON schemas in memory — no DOM or browser dependency required. The server provides tools for creating forms, adding/removing/replacing components, setting validation and layout, and exporting schemas.

## Setup

### VS Code MCP Configuration

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "form": {
      "command": "npx",
      "args": ["form-js-mcp"]
    }
  }
}
```

With file persistence:

```json
{
  "servers": {
    "form": {
      "command": "npx",
      "args": ["form-js-mcp", "--persist-dir", "./forms"]
    }
  }
}
```

### Local Development

```bash
npm install
npm run build
npm start
```

## AI Agent Instructions

When working with `.form` files or form schemas:

1. **Always use MCP tools** — do not manually write JSON schemas; use the provided tools to create, modify, and export forms.
2. **Start with `create_form`** to get a `formId` — pass a `schema` param to import an existing JSON schema, or `cloneFromId` to clone an existing form.
3. **Add components** with `add_form_component` — keyed types auto-generate unique keys.
4. **Set properties** with `set_form_component_properties` — supports validation, layout, conditional, and option properties in a single call.
5. **Inspect** with `inspect_form` — use facets like `"validation"`, `"summary"`, `"variables"`, `"components"`, or `"schema"` to examine the form.
6. **Export** with `inspect_form({ include: ["schema"] })` to get the final JSON schema.

## Form Modeling Best Practices

- **Naming:** Use descriptive keys that match process variable names (e.g. `firstName`, `orderAmount`).
- **Validation:** Always set `required: true` on mandatory fields. Use `minLength`/`maxLength` for text, `min`/`max` for numbers.
- **Layout:** The form uses a 16-column grid. Use `set_form_component_properties` to control column widths and `modify_form_component({ action: "auto-layout" })` for automatic layouts.
- **Conditionals:** Use `set_form_component_properties` with `conditional` in the `properties` bag to show/hide fields based on FEEL expressions.
- **Groups:** Use `group` containers to organize related fields. Use `dynamiclist` for repeatable sections.

## Available Tools

| Tool                            | Description                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `create_form`                   | Create, clone, or import a form                                              |
| `delete_form`                   | Delete a form from memory                                                    |
| `inspect_form`                  | Inspect forms — list all, summarize, validate, diff, export, list components |
| `batch_form_operations`         | Execute multiple operations atomically                                       |
| `form_history`                  | Undo/redo form changes                                                       |
| `add_form_component`            | Add or duplicate a component                                                 |
| `modify_form_component`         | Delete, move, or auto-layout components                                      |
| `set_form_component_properties` | Update component properties, validation, layout, conditionals                |

## Available Resources

| URI Pattern                          | Description                        |
| ------------------------------------ | ---------------------------------- |
| `form://forms`                       | List all in-memory forms           |
| `form://form/{formId}/summary`       | Form summary                       |
| `form://form/{formId}/schema`        | Current JSON schema                |
| `form://form/{formId}/validation`    | Validation issues                  |
| `form://form/{formId}/variables`     | Input/output variables             |
| `form://guides/form-field-reference` | Comprehensive field type reference |

## Available Prompts

| Prompt                    | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `create-user-task-form`   | Step-by-step guide for Camunda user task forms |
| `create-approval-form`    | Template for approval workflows                |
| `add-conditional-section` | Guide for conditional field groups             |
| `create-multi-step-form`  | Multi-section forms using groups               |
| `convert-to-dynamic-list` | Repeatable sections using dynamiclist          |

## License

MIT
