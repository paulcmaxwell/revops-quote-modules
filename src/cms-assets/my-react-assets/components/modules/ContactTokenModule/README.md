# Contact Token

Renders CRM values on a quote using `[object.property]` tokens.

Usage, token syntax, and deployment are documented in the [project README](../../../../../../README.md).
This file covers the internals.

## Files

- `index.tsx` — `Component`, `meta`, `hublDataTemplate`
- `fields.tsx` — editor sidebar fields and the `FieldValues` type

## How a token resolves

`parseToken` splits `contact.firstname` into a namespace and a property. An
unprefixed token defaults to the `contact` namespace. Namespaces are declared in
`NAMESPACE_ALIASES`; each maps to a record exposed by `hublDataTemplate` under
`hublData.objects`.

`resolveParsed` then checks, in order:

1. `hublData.fetched[namespace][property]` — properties named in the "extra
   properties to fetch" fields and re-read via `crm_object`.
2. `hublData.objects[namespace][property]` — the record carried on the quote.

It returns `undefined` when the property is absent from the record entirely, and
`''` when present but empty. That distinction is what lets the UI report
`NOT FOUND` separately from `empty`, and it drives the editor-vs-published
behaviour for unresolved tokens.

## The HubL block is deliberately loop-free

`hublDataTemplate` uses only documented HubL behaviour — attribute access,
`{% if %}`, and `crm_object`. There are no `{% for %}` loops, no accumulator
objects, and no `{% do %}` mutation.

That is intentional. A `{% set %}` inside a HubL `{% for %}` loop does not
persist after the loop, and the usual workaround (mutating a dict with
`{% do dict.update(...) %}`) is documented for HubL generally but not confirmed
inside `hublDataTemplate` specifically. Driving the property lists from plain
comma-separated text fields avoids depending on either.

If you add a namespace, keep this property: expose the record with a plain
`{% set %}` and add it to the `hublData.objects` dict literal.

## Adding a namespace

1. Add the record in `hublDataTemplate` and include it in `hublData.objects`.
2. Add the key to the `objects` type in the `HublData` interface.
3. Add its token prefix(es) to `NAMESPACE_ALIASES`.
4. If it should support `crm_object` enrichment, add it to `FETCHABLE`, add a
   matching `extra…Properties` text field in `fields.tsx`, and add the guarded
   `crm_object` call.
5. Optionally add sample values to `BLUEPRINT_PLACEHOLDERS` so quote templates
   still preview sensibly.

## Escaping

Values from the CRM pass through `escapeHtml` before being substituted into the
rich text HTML, which then goes through `dangerouslySetInnerHTML`. The HTML
itself is authored by the quote builder in the sidebar; only the substituted
values come from the CRM, and those are always escaped. Keep it that way.
