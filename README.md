# Contact Token — a HubSpot custom quote module

A Revenue Hub custom quote module that renders CRM values on a quote, using
`[object.property]` tokens.

HubSpot's quote editor does not evaluate HubL. Typing `{{ contact.email }}` into
a quote text block prints the literal string, and the built-in token picker only
offers a fixed handful of fields with no contact properties among them. This
module resolves values server-side instead, so any property on the contact,
company, deal, or quote can appear on a quote.

---

## Tokens

Write tokens as `object.property`:

| Token | Reads from |
| --- | --- |
| `[contact.firstname]` | the buyer contact on the quote |
| `[company.name]` | the buyer company |
| `[deal.dealname]` | the associated deal |
| `[quote.hs_title]` | the quote itself |
| `[billing_contact.email]` | the billing contact |
| `[billing_company.name]` | the billing company |
| `[firstname]` | shorthand — no prefix means the contact |

`{{ contact.firstname }}` and `{{ template_data.contact.firstname }}` are also
accepted, but **square brackets are recommended** — HubL never touches them, so
they cannot be consumed before the module sees them.

`property` is the **internal name**, not the label. Find it in HubSpot under
Settings → Properties → click the property → *Internal name*. Turning on
**Show troubleshooting details** also lists every available property directly on
the quote.

### Two display modes

**Text with tokens inside it** — a rich text field with tokens inline:

> Hi [contact.firstname], this quote was prepared for [company.name].

**A list of labelled fields** — one row per token, rendered as a two-column,
stacked, or inline list. Labels derive from the property name unless overridden.

### Unresolved tokens

A token that does not match a property stays **visible while editing** so the
mistake is obvious, and is **dropped on the published quote** so a buyer never
sees a raw `[contact.firstname]` in their document.

---

## Using it on a quote

1. Commerce → Quotes → create or edit a quote.
2. In the left sidebar of the quote editor, click the **+** icon.
3. Drag **Contact Token** into the quote body.
4. Set **Display as**, then write your text or add rows under *Fields to display*.
5. Turn on **Show troubleshooting details** while setting it up. Turn it off
   before publishing.

> **Published quotes render once, at publish time.** A quote that is already
> published will never pick up a new build of this module. Test on a draft, or
> re-publish. This is the single most common reason a change "does nothing".

### Custom properties

Most properties resolve with no setup. If the troubleshooting panel reports a
token as `NOT FOUND`, add its internal name to **Extra contact / company / deal
properties to fetch** (comma-separated). Those are re-read directly from the CRM
record with `crm_object`.

---

## Deploying to HubSpot

### Prerequisites

- **Revenue Hub Professional or Enterprise.** Custom quote modules are not
  available on lower tiers.
- Node.js 20+.
- HubSpot CLI v7+: `npm install -g @hubspot/cli`

### Authenticate

CLI v7 uses a global config at `~/.hscli/config.yml`. The older `hs auth`
command no longer works with it:

```bash
hs account auth --account=<PORTAL_ID>
```

This opens `app.hubspot.com/l/personal-access-key` to copy a personal access
key. The key must be generated **while logged into the target portal** — a key
is bound to one user *and* one portal. The key needs at least
`developer.projects.write`, `cms.source_code.write`, `crm.objects.contacts.read`
and `crm.schemas.contacts.read`; verify with `hs account info`.

> If the key page reports *"permissions do not match the account permissions"*,
> the key is stale. Deactivate it and generate a new one. If a fresh key still
> fails, your HubSpot user lacks the underlying permission and an admin must
> grant it — a key can only carry scopes the user already has.

### Pin the account, then upload

```bash
hs account create-override <PORTAL_ID>   # writes .hsaccount, pins this directory
npm install
hs project upload
```

`hs project upload --account=<id>` **silently falls back to your default
account** when `<id>` is not in the config, so pinning with `.hsaccount` is
worth doing. Add `--force-create` on the very first upload.

Uploading builds and deploys in one step; the module appears in the quote editor
immediately. Occasional transient `Failed to upload` errors just need a retry.

---

## Working on the module

```
src/cms-assets/my-react-assets/
├── package.json                       # React + @hubspot/cms-components
└── components/modules/ContactTokenModule/
    ├── index.tsx                      # Component, meta, hublDataTemplate
    ├── fields.tsx                     # editor sidebar fields
    └── README.md
```

A module exports four things from `index.tsx`:

- **`Component`** — React, server-rendered, receives `{ fieldValues, hublData }`
- **`fields`** — the editor sidebar, as JSX
- **`meta`** — `content_types` must include `QUOTE` and `QUOTE_BLUEPRINT`
- **`hublDataTemplate`** — a HubL string, evaluated server-side, that sets
  `hublData`

Typecheck before uploading:

```bash
cd src/cms-assets/my-react-assets && npx tsc --noEmit
```

### Where data comes from

`quoteTemplateContext` is a HubL global holding the quote and its associated
records. Its exact shape is published as TypeScript types in
[`@hubspot/quote-dev-sdk`](https://www.npmjs.com/package/@hubspot/quote-dev-sdk) —
read `node_modules/@hubspot/quote-dev-sdk/quoteTemplateContext.d.ts` rather than
guessing. Top level: `quote`, `deal`, `lineItems`, `buyerContacts`,
`buyerCompany`, `billingContact`, `billingCompany`, `quoteDocuments`, `signers`,
`counterSigners`.

`hublDataTemplate` can read the module's own field values as `module.<fieldName>`.
That is how the "extra properties to fetch" fields drive the `crm_object` calls.

### Ideas for improvement

- **Line items.** `quoteTemplateContext.lineItems` is an array and is not
  exposed as tokens yet. A `lineItems` loop would need a repeating layout rather
  than the flat token model.
- **A property picker instead of typed names.** `CrmObjectPropertyField` renders
  a real property dropdown, but `objectType` is static per field, so supporting
  four objects would mean four separate repeaters. Typed dotted tokens were
  chosen to keep one uniform syntax.
- **Date and currency formatting.** Values render as stored. A `formatValue`
  extension could format dates and amounts using the quote's locale and currency
  (`quote.hs_locale`, `quote.hs_currency`).
- **More namespaces.** Add to `NAMESPACE_ALIASES` in `index.tsx`, expose the
  record in `hublDataTemplate`, and it becomes available as a token prefix.
- **Owner / sender tokens.** Sender details already live on the quote as
  `quote.hs_sender_*`, so `[quote.hs_sender_firstname]` works today; a friendlier
  `[sender.firstname]` alias would be a small addition.

### Constraints worth knowing

- `crm_object` is capped at **10 calls per rendered page**. Each of the three
  "extra properties" fields costs one call when used, and each module instance
  counts separately.
- A `{% set %}` inside a HubL `{% for %}` loop does **not** persist after the
  loop. `hublDataTemplate` here is deliberately loop-free for that reason.
- New builds apply to future quotes and unpublished drafts — never to quotes
  already published.
- Deleting a module from the project removes it from templates and draft quotes.
  Restore it by re-deploying an older build from the HubSpot projects UI.
- Islands are not used, so no CRM data is serialized into the published page
  beyond the text actually rendered. If you add an island, only pass the
  specific scalar values it renders — island props are visible in page source.
