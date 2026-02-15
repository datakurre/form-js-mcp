# AGENTS.md

## Project Overview

**form-js-mcp** is an MCP (Model Context Protocol) server that provides AI assistants with tools to create and manipulate JSON-based forms compatible with [@bpmn-io/form-js](https://github.com/bpmn-io/form-js).

**Tech Stack:** TypeScript, Node.js, esbuild (bundler), vitest (testing), Prettier + ESLint (formatting/linting), MCP SDK.

## Architecture

| File                        | Responsibility                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`              | MCP server entry point — wires transport, tools, resources, prompts                                                              |
| `src/module.ts`             | Generic `ToolModule` interface                                                                                                   |
| `src/form-module.ts`        | Form tool module — registers tools with the server                                                                               |
| `src/types.ts`              | Shared types: `FormState`, `FormSchema`, `FormComponent`, `ToolResult`                                                           |
| `src/constants.ts`          | Field type classifications, grid defaults, exporter metadata                                                                     |
| `src/form-manager.ts`       | In-memory form store (Map-based) + schema helpers                                                                                |
| `src/validator.ts`          | Semantic validation (duplicate IDs/keys, missing keys, unknown types)                                                            |
| `src/resources.ts`          | MCP resource endpoints (`form://` URIs)                                                                                          |
| `src/prompts.ts`            | MCP prompt workflows                                                                                                             |
| `src/prompt-definitions.ts` | Prompt definition objects                                                                                                        |
| `src/tool-definitions.ts`   | Re-exports `TOOL_DEFINITIONS` from handlers                                                                                      |
| `src/handlers/index.ts`     | `TOOL_REGISTRY`, `TOOL_DEFINITIONS`, `dispatchToolCall`                                                                          |
| `src/handlers/helpers.ts`   | Shared handler utilities (validation, component lookup, results)                                                                 |
| `src/handlers/core/`        | Form lifecycle: create (+ import/clone), delete, inspect (+ validate/summarize/diff/export/list-components), export-form-to-file |
| `src/handlers/components/`  | Component CRUD: add (+ duplicate), modify (delete/move/auto-layout)                                                              |
| `src/handlers/properties/`  | Property setter: `set_form_component_properties` (type, validation, conditional, layout, options)                                |

## Tool Naming Convention

All tool names include `form` to avoid collisions when running alongside other MCP servers (e.g. `bpmn-js-mcp`). Examples: `create_form`, `add_form_component`, `set_form_component_properties`.

## Build & Run

```bash
npm install          # Install dependencies
npm run build        # Bundle with esbuild → dist/index.js
npm start            # Start MCP server on stdio
npm run dev          # Watch mode (nodemon + esbuild)
```

Or using Make:

```bash
make build           # Bundle
make check           # typecheck + lint
make test            # Run tests
make format          # Format with Prettier
```

## Testing

```bash
npm test             # Run all tests (vitest)
npm run test:watch   # Watch mode
npm run coverage     # Coverage report
```

Tests are in `test/` mirroring the `src/` structure. Test helpers are in `test/helpers.ts`.

## Code Conventions

- **Handler pattern:** Each handler file exports `TOOL_DEFINITION` (const object) and a `handle*` async function.
- **Validation:** Use `validateArgs()` for required argument checks. Use `requireForm()` / `requireComponent()` to fetch-or-throw.
- **Results:** Use `jsonResult()` for read-only responses, `mutationResult()` for mutations (auto-appends validation hints).
- **Versioning:** Call `bumpVersion(form)` after every mutation.
- **ID generation:** Use `generateComponentId(type, label)` for component IDs.
- **No DOM/browser deps:** Form schemas are pure JSON — never import browser APIs.

## Key Gotchas

1. **Hint levels:** Mutating handlers auto-append `_hints` to responses based on `form.hintLevel` (`'full'` | `'minimal'` | `'none'`).
2. **Key uniqueness:** `add_form_component` and `duplicate_form_component` auto-deduplicate keys by appending numeric suffixes.
3. **16-column grid:** form-js uses a fixed 16-column grid. `layout.columns` values range from 1–16.
