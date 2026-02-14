# Architecture

Module dependency diagram and data flow for form-js-mcp.

## High-level Overview

form-js-mcp is an MCP (Model Context Protocol) server that exposes AI-friendly
tools for creating and manipulating JSON-based forms compatible with
[@bpmn-io/form-js](https://github.com/bpmn-io/form-js).

Unlike bpmn-js-mcp (which requires a headless DOM/SVG environment), form-js
schemas are **pure JSON** — no browser or DOM dependency is needed. The server
manipulates form schemas entirely in memory using plain object operations.

## Module Dependency Diagram

```
                        ┌─────────────┐
                        │  index.ts   │  MCP server entry point
                        │  (stdio)    │  CLI parsing, transport wiring
                        └──────┬──────┘
                               │ imports
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌─────────────┐ ┌───────────┐  ┌───────────┐
        │ form-module  │ │ resources │  │  prompts  │
        │  .ts         │ │    .ts    │  │    .ts    │
        └──────┬───────┘ └─────┬─────┘  └─────┬─────┘
               │               │              │
               │               │              ▼
               │               │       ┌──────────────────┐
               │               │       │ prompt-definitions│
               │               │       │       .ts         │
               │               │       └──────────────────┘
               │               │
               ▼               │
     ┌──────────────────┐      │
     │  handlers/index  │      │
     │  (TOOL_REGISTRY) │      │
     └────────┬─────────┘      │
              │ imports         │
    ┌─────────┼──────────┐     │
    ▼         ▼          ▼     │
┌────────┐┌────────┐┌────────┐ │
│ core/  ││ compo- ││ props/ │ │
│handlers││ nents/ ││handlers│ │
└───┬────┘└───┬────┘└───┬────┘ │
    │         │         │      │
    └─────────┼─────────┘      │
              ▼                ▼
       ┌──────────────┐  ┌──────────────┐
       │   helpers.ts  │  │ form-manager │
       │ (shared utils)│  │     .ts      │
       └──────┬────────┘  └──────┬───────┘
              │                  │
              ▼                  │
       ┌──────────────┐          │
       │  validator.ts │◄─────────┘
       └──────┬────────┘
              │
              ▼
       ┌──────────────┐
       │ constants.ts  │
       └──────────────┘
              │
              ▼
       ┌──────────────┐
       │   types.ts    │
       └──────────────┘
```

## Data Flow

### 1. Tool Call Flow (Create / Mutate / Query)

```
AI Assistant
    │
    ▼
MCP Client (VS Code / Claude Desktop)
    │  JSON-RPC over stdio
    ▼
┌────────────────────────────────────────────┐
│ index.ts  — Server                         │
│  ├─ ListToolsRequest  → TOOL_DEFINITIONS   │
│  ├─ CallToolRequest   → dispatch           │
│  ├─ ListResources     → listResources()    │
│  ├─ ReadResource      → readResource(uri)  │
│  ├─ ListPrompts       → listPrompts()      │
│  └─ GetPrompt         → getPrompt(name)    │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│ form-module.ts                             │
│  dispatch(toolName, args)                  │
│  → checks if toolName belongs to module    │
│  → delegates to dispatchToolCall()         │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│ handlers/index.ts                          │
│  dispatchToolCall(name, args)              │
│  → lookup handler in TOOL_REGISTRY map     │
│  → invoke handler function                 │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│ Handler (e.g. add-form-component.ts)       │
│  1. validateArgs(args, [...required])      │
│  2. requireForm(formId)                    │
│  3. Perform mutation on form.schema        │
│  4. bumpVersion(form)                      │
│  5. return mutationResult(form, data)      │
│     └─ auto-appends _hints if hintLevel    │
└────────────────┬───────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────┐
│ form-manager.ts (in-memory Map store)      │
│  Map<formId, FormState>                    │
│  FormState = { schema, name, version, … }  │
└────────────────────────────────────────────┘
```

### 2. Resource Read Flow

```
AI Assistant
    │  ReadResource("form://form/{id}/schema")
    ▼
index.ts → readResource(uri)
    │
    ▼
resources.ts
    ├─ Parse URI pattern
    ├─ Fetch form from form-manager
    ├─ Format response (JSON or Markdown)
    └─ Return ResourceContent { uri, mimeType, text }
```

### 3. Batch Operations (Atomic)

```
batch_form_operations({ formId, operations: [...] })
    │
    ▼
  Snapshot current schema (deep clone)
    │
    ▼
  For each operation:
    ├─ dispatchToolCall(op.tool, op.args)
    ├─ On success → continue
    └─ On failure → ROLLBACK (restore snapshot) → return error
    │
    ▼
  All succeeded → return combined results
```

### 4. History (Undo / Redo)

```
pushSnapshot(formId, schema)  ← called before mutations
    │
    ▼
historyStore: Map<formId, { undoStack[], redoStack[] }>

undo:
    undoStack.pop() → restore to form.schema
    current state → redoStack.push()

redo:
    redoStack.pop() → restore to form.schema
    current state → undoStack.push()
```

## Key Design Decisions

### Pure JSON Manipulation

Form-js schemas are plain JSON objects. No DOM, no headless browser, no
XML parsing. This makes the server lightweight and fast. All mutations are
direct object property changes on the in-memory `FormState.schema`.

### 16-Column Grid Layout

Form-js uses a fixed 16-column grid system. Components specify their width
via `layout.columns` (1–16) and share rows via `layout.row` identifiers.
The `auto_layout_form` tool assigns these automatically using one of three
strategies: single-column, two-column, or compact.

### Pluggable Module Architecture

The server uses a `ToolModule` interface so that multiple editor back-ends
(BPMN, DMN, Forms) can coexist in a single MCP server. Currently only the
Form module is active. Each module declares which tool names it owns and
routes dispatch accordingly.

### Handler Co-location Pattern

Each handler file co-locates its `TOOL_DEFINITION` constant alongside its
handler function. The barrel `handlers/index.ts` imports all handlers and
builds the registry automatically. This keeps definitions and logic together
and prevents drift.

### Validation Hints

Mutating handlers automatically append `_hints` to responses. The hint level
is configurable per-form (`'full'`, `'minimal'`, `'none'`) and drives whether
validation warnings and/or errors are included in every mutation response.

## File Responsibilities

| File                        | Responsibility                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`              | MCP server entry point — CLI parsing, transport wiring, request routing                                                        |
| `src/module.ts`             | Generic `ToolModule` interface for pluggable modules                                                                           |
| `src/form-module.ts`        | Form tool module — registers tools, dispatches calls                                                                           |
| `src/types.ts`              | Shared types: `FormState`, `FormSchema`, `FormComponent`, `ToolResult`                                                         |
| `src/constants.ts`          | Field type classifications, grid defaults, exporter metadata                                                                   |
| `src/form-manager.ts`       | In-memory form store (`Map<string, FormState>`) + schema helpers                                                               |
| `src/validator.ts`          | Semantic validation (duplicate IDs/keys, missing keys, unknown types)                                                          |
| `src/resources.ts`          | MCP resource endpoints (`form://` URIs)                                                                                        |
| `src/prompts.ts`            | MCP prompt workflow implementations                                                                                            |
| `src/prompt-definitions.ts` | Prompt definition objects (name, description, arguments)                                                                       |
| `src/tool-definitions.ts`   | Re-exports `TOOL_DEFINITIONS` from handlers                                                                                    |
| `src/handlers/index.ts`     | `TOOL_REGISTRY`, `TOOL_DEFINITIONS`, `dispatchToolCall`                                                                        |
| `src/handlers/helpers.ts`   | Shared handler utilities (validation, lookup, results)                                                                         |
| `src/handlers/core/`        | Form lifecycle: create, delete, list, clone, import, export, validate, summarize, diff, auto-layout, batch, history, variables |
| `src/handlers/components/`  | Component CRUD: add, delete, move, duplicate, list, replace                                                                    |
| `src/handlers/properties/`  | Property setters: set-properties, set-validation, set-conditional, set-layout, set-options                                     |
