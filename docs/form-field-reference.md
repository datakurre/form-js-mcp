# Form Field Type Reference

Comprehensive reference for all 21 supported form-js field types with JSON
examples, supported properties, and validation options.

---

## Input Fields

Input fields are **keyed** — they bind to process variables via the `key`
property and collect user data.

### textfield

Single-line text input.

```json
{
  "type": "textfield",
  "id": "Textfield_name",
  "key": "fullName",
  "label": "Full Name",
  "description": "Enter your full legal name",
  "validate": {
    "required": true,
    "minLength": 2,
    "maxLength": 100
  },
  "layout": { "columns": 8 }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`

**Validation options:** `required`, `minLength`, `maxLength`, `pattern`, `validationType` (`email` | `phone`), `validationError`

---

### textarea

Multi-line text input.

```json
{
  "type": "textarea",
  "id": "Textarea_comments",
  "key": "comments",
  "label": "Comments",
  "description": "Enter additional comments",
  "validate": {
    "maxLength": 500
  },
  "layout": { "columns": 16 }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`

**Validation options:** `required`, `minLength`, `maxLength`, `pattern`, `validationError`

---

### number

Numeric input with optional min/max constraints.

```json
{
  "type": "number",
  "id": "Number_age",
  "key": "age",
  "label": "Age",
  "validate": {
    "required": true,
    "min": 0,
    "max": 150
  },
  "layout": { "columns": 8 }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`, `decimalDigits`, `increment`, `serializeToString`

**Validation options:** `required`, `min`, `max`, `validationError`

---

### datetime

Date and/or time picker.

```json
{
  "type": "datetime",
  "id": "Datetime_start",
  "key": "startDate",
  "label": "Start Date",
  "subtype": "date",
  "validate": {
    "required": true
  }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`, `subtype` (`date` | `time` | `datetime`), `use24h`

**Validation options:** `required`, `validationError`

---

### expression

Computed value via a FEEL expression. Not directly editable by the user.

```json
{
  "type": "expression",
  "id": "Expression_total",
  "key": "totalPrice",
  "label": "Total Price",
  "expression": "=quantity * unitPrice"
}
```

**Supported properties:** `key`, `label`, `description`, `expression`, `conditional`, `layout`, `properties`

**Validation options:** None (computed field)

---

### filepicker

File upload input.

```json
{
  "type": "filepicker",
  "id": "Filepicker_docs",
  "key": "documents",
  "label": "Upload Documents",
  "validate": {
    "required": true
  }
}
```

**Supported properties:** `key`, `label`, `description`, `validate`, `conditional`, `layout`, `properties`, `accept`, `multiple`

**Validation options:** `required`, `validationError`

---

## Selection Fields

Selection fields are **keyed** — they bind to process variables and provide
predefined options for the user to choose from.

### checkbox

Boolean toggle (true/false).

```json
{
  "type": "checkbox",
  "id": "Checkbox_agree",
  "key": "agreeToTerms",
  "label": "I agree to the terms and conditions",
  "validate": {
    "required": true
  },
  "layout": { "columns": 16 }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`

**Validation options:** `required`, `validationError`

---

### checklist

Multi-select checkboxes from a list of options.

```json
{
  "type": "checklist",
  "id": "Checklist_skills",
  "key": "skills",
  "label": "Skills",
  "values": [
    { "label": "JavaScript", "value": "js" },
    { "label": "TypeScript", "value": "ts" },
    { "label": "Python", "value": "py" }
  ],
  "validate": {
    "required": true
  }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`, `values`, `valuesKey`, `valuesExpression`

**Validation options:** `required`, `validationError`

---

### radio

Single-select radio button group.

```json
{
  "type": "radio",
  "id": "Radio_priority",
  "key": "priority",
  "label": "Priority",
  "values": [
    { "label": "Low", "value": "low" },
    { "label": "Medium", "value": "medium" },
    { "label": "High", "value": "high" }
  ],
  "validate": {
    "required": true
  }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`, `values`, `valuesKey`, `valuesExpression`

**Validation options:** `required`, `validationError`

---

### select

Dropdown single-select.

```json
{
  "type": "select",
  "id": "Select_country",
  "key": "country",
  "label": "Country",
  "values": [
    { "label": "Germany", "value": "DE" },
    { "label": "United States", "value": "US" },
    { "label": "Japan", "value": "JP" }
  ],
  "validate": {
    "required": true
  }
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`, `values`, `valuesKey`, `valuesExpression`, `searchable`

**Validation options:** `required`, `validationError`

---

### taglist

Multi-select tag input (chips/tags UI).

```json
{
  "type": "taglist",
  "id": "Taglist_tags",
  "key": "tags",
  "label": "Tags",
  "values": [
    { "label": "Urgent", "value": "urgent" },
    { "label": "Review", "value": "review" },
    { "label": "Approved", "value": "approved" }
  ]
}
```

**Supported properties:** `key`, `label`, `description`, `defaultValue`, `disabled`, `readonly`, `validate`, `conditional`, `layout`, `properties`, `values`, `valuesKey`, `valuesExpression`

**Validation options:** `required`, `validationError`

---

## Presentation Fields

Presentation fields are **non-keyed** — they display static content and do
not bind to process variables.

### text

Static text content. Supports Markdown.

```json
{
  "type": "text",
  "id": "Text_intro",
  "text": "# Welcome\n\nPlease fill out the form below."
}
```

**Supported properties:** `text`, `conditional`, `layout`, `properties`

**Validation options:** None

---

### html

Raw HTML content.

```json
{
  "type": "html",
  "id": "Html_notice",
  "content": "<div class=\"alert\"><strong>Notice:</strong> All fields are required.</div>"
}
```

**Supported properties:** `content`, `conditional`, `layout`, `properties`

**Validation options:** None

---

### image

Static image display.

```json
{
  "type": "image",
  "id": "Image_logo",
  "source": "https://example.com/logo.png",
  "alt": "Company Logo"
}
```

**Supported properties:** `source`, `alt`, `conditional`, `layout`, `properties`

**Validation options:** None

---

### table

Data table display.

```json
{
  "type": "table",
  "id": "Table_items",
  "label": "Order Items",
  "columns": [
    { "key": "name", "label": "Item" },
    { "key": "qty", "label": "Quantity" },
    { "key": "price", "label": "Price" }
  ],
  "dataSource": "=orderItems"
}
```

**Supported properties:** `label`, `columns`, `dataSource`, `conditional`, `layout`, `properties`

**Validation options:** None

---

### documentPreview

Document preview component for displaying PDF or other documents.

```json
{
  "type": "documentPreview",
  "id": "DocPreview_contract",
  "label": "Contract Preview",
  "documentSource": "=contractDocument"
}
```

**Supported properties:** `label`, `documentSource`, `conditional`, `layout`, `properties`

**Validation options:** None

---

### spacer

Vertical spacing element. Used to add empty space between components.

```json
{
  "type": "spacer",
  "id": "Spacer_1",
  "height": 30
}
```

**Supported properties:** `height`, `conditional`, `layout`, `properties`

**Validation options:** None

---

### separator

Horizontal rule separator. Visually divides sections of a form.

```json
{
  "type": "separator",
  "id": "Separator_1"
}
```

**Supported properties:** `conditional`, `layout`, `properties`

**Validation options:** None

---

## Container Fields

Container fields can have nested `components` arrays.

### group

Groups fields together under a common label. Children are rendered inside
a bordered section.

```json
{
  "type": "group",
  "id": "Group_personal",
  "label": "Personal Information",
  "components": [
    { "type": "textfield", "id": "tf1", "key": "firstName", "label": "First Name" },
    { "type": "textfield", "id": "tf2", "key": "lastName", "label": "Last Name" }
  ]
}
```

**Supported properties:** `label`, `components`, `conditional`, `layout`, `properties`, `showOutline`

**Validation options:** None (validates children individually)

---

### dynamiclist

Repeatable list of field groups. Users can add/remove rows. Data is bound
as an array of objects.

```json
{
  "type": "dynamiclist",
  "id": "Dynamiclist_items",
  "key": "lineItems",
  "label": "Line Items",
  "components": [
    { "type": "textfield", "id": "tf1", "key": "itemName", "label": "Item" },
    { "type": "number", "id": "n1", "key": "quantity", "label": "Qty" },
    { "type": "number", "id": "n2", "key": "unitPrice", "label": "Unit Price" }
  ]
}
```

**Supported properties:** `key`, `label`, `components`, `defaultValue`, `conditional`, `layout`, `properties`, `allowAddRemove`, `disableCollapse`

**Validation options:** None (validates children per row)

---

### iframe

Embedded iframe content.

```json
{
  "type": "iframe",
  "id": "Iframe_help",
  "label": "Help Documentation",
  "url": "https://docs.example.com/help",
  "height": 400
}
```

**Supported properties:** `label`, `url`, `height`, `conditional`, `layout`, `properties`

**Validation options:** None

---

## Action Fields

### button

Action button for form submission, reset, or custom actions.

```json
{
  "type": "button",
  "id": "Button_submit",
  "key": "submit",
  "label": "Submit",
  "action": "submit"
}
```

**Supported properties:** `key`, `label`, `action` (`submit` | `reset`), `conditional`, `layout`, `properties`

**Validation options:** None

---

## Quick Reference Table

| Type              | Category     | Keyed | Options | Container | Description             |
| ----------------- | ------------ | ----- | ------- | --------- | ----------------------- |
| `textfield`       | Input        | ✅    | —       | —         | Single-line text input  |
| `textarea`        | Input        | ✅    | —       | —         | Multi-line text input   |
| `number`          | Input        | ✅    | —       | —         | Numeric input           |
| `datetime`        | Input        | ✅    | —       | —         | Date/time picker        |
| `expression`      | Input        | ✅    | —       | —         | Computed FEEL value     |
| `filepicker`      | Input        | ✅    | —       | —         | File upload             |
| `checkbox`        | Selection    | ✅    | —       | —         | Boolean toggle          |
| `checklist`       | Selection    | ✅    | ✅      | —         | Multi-select checkboxes |
| `radio`           | Selection    | ✅    | ✅      | —         | Single-select radios    |
| `select`          | Selection    | ✅    | ✅      | —         | Dropdown select         |
| `taglist`         | Selection    | ✅    | ✅      | —         | Multi-select tags       |
| `text`            | Presentation | —     | —       | —         | Static text / Markdown  |
| `html`            | Presentation | —     | —       | —         | Raw HTML                |
| `image`           | Presentation | —     | —       | —         | Static image            |
| `table`           | Presentation | —     | —       | —         | Data table              |
| `documentPreview` | Presentation | —     | —       | —         | Document preview        |
| `spacer`          | Presentation | —     | —       | —         | Vertical spacer         |
| `separator`       | Presentation | —     | —       | —         | Horizontal rule         |
| `group`           | Container    | —     | —       | ✅        | Field group             |
| `dynamiclist`     | Container    | ✅    | —       | ✅        | Repeatable list         |
| `iframe`          | Container    | —     | —       | ✅        | Embedded iframe         |
| `button`          | Action       | —     | —       | —         | Action button           |

## Validation Properties Reference

| Property              | Applies to              | Description                        |
| --------------------- | ----------------------- | ---------------------------------- |
| `required`            | All keyed types         | Field must have a value            |
| `minLength`           | `textfield`, `textarea` | Minimum character count            |
| `maxLength`           | `textfield`, `textarea` | Maximum character count            |
| `min`                 | `number`                | Minimum numeric value              |
| `max`                 | `number`                | Maximum numeric value              |
| `pattern`             | `textfield`, `textarea` | Regex pattern to match             |
| `patternErrorMessage` | `textfield`, `textarea` | Custom message for pattern failure |
| `validationType`      | `textfield`             | Built-in: `email` or `phone`       |
| `validationError`     | All keyed types         | Custom error message text          |

## Layout Properties

Forms use a **16-column grid** system:

- `layout.columns` — Column span (1–16). Default: 16 (full width).
- `layout.row` — Row identifier string. Components sharing the same `row` value are placed side-by-side.

```json
{
  "layout": {
    "columns": 8,
    "row": "Row_abc123"
  }
}
```

## Conditional Visibility

Any component can be conditionally hidden using a FEEL expression:

```json
{
  "conditional": {
    "hide": "=status != \"active\""
  }
}
```

When the expression evaluates to `true`, the component is hidden. Fields inside
a conditional `group` inherit the group's visibility.

## Options (Values)

Selection fields (`select`, `radio`, `checklist`, `taglist`) support three
ways to provide options:

### Static values

```json
{
  "values": [
    { "label": "Option A", "value": "a" },
    { "label": "Option B", "value": "b" }
  ]
}
```

### Dynamic from input data

```json
{
  "valuesKey": "availableOptions"
}
```

### Dynamic from FEEL expression

```json
{
  "valuesExpression": "=departments"
}
```
