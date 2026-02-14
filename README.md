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
2. **Start with `create_form`** or **`import_form_schema`** to get a `formId`.
3. **Add components** with `add_form_component` — keyed types auto-generate unique keys.
4. **Set properties** with `set_form_component_properties`, `set_form_validation`, `set_form_layout`, etc.
5. **Validate** with `validate_form` before exporting.
6. **Export** with `export_form` to get the final JSON schema.

## Form Modeling Best Practices

- **Naming:** Use descriptive keys that match process variable names (e.g. `firstName`, `orderAmount`).
- **Validation:** Always set `required: true` on mandatory fields. Use `minLength`/`maxLength` for text, `min`/`max` for numbers.
- **Layout:** The form uses a 16-column grid. Use `set_form_layout` to control column widths and `auto_layout_form` for automatic layouts.
- **Conditionals:** Use `set_form_conditional` with FEEL expressions to show/hide fields based on other field values.
- **Groups:** Use `group` containers to organize related fields. Use `dynamiclist` for repeatable sections.

## Available Tools

| Tool                            | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| `create_form`                   | Create a new empty form                              |
| `import_form_schema`            | Import an existing JSON schema                       |
| `export_form`                   | Export form as JSON                                  |
| `delete_form`                   | Delete a form from memory                            |
| `list_forms`                    | List all in-memory forms                             |
| `clone_form`                    | Deep-clone a form with new IDs                       |
| `validate_form`                 | Validate a form schema                               |
| `summarize_form`                | Get a structured summary of a form                   |
| `get_form_variables`            | Extract input/output variable keys                   |
| `diff_forms`                    | Structural diff between two forms                    |
| `auto_layout_form`              | Auto-assign grid layout to components                |
| `batch_form_operations`         | Execute multiple operations atomically               |
| `form_history`                  | Undo/redo form changes                               |
| `add_form_component`            | Add a component to a form                            |
| `delete_form_component`         | Remove a component                                   |
| `move_form_component`           | Reorder or reparent a component                      |
| `duplicate_form_component`      | Deep-clone a component                               |
| `list_form_components`          | List components (optionally filtered)                |
| `replace_form_component`        | Change component type preserving compatible props    |
| `get_form_component_properties` | Read component properties                            |
| `set_form_component_properties` | Update component properties                          |
| `set_form_validation`           | Set validation rules on a component                  |
| `set_form_conditional`          | Set conditional visibility                           |
| `set_form_layout`               | Set grid layout (columns)                            |
| `set_form_options`              | Set option values for select/radio/checklist/taglist |

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
