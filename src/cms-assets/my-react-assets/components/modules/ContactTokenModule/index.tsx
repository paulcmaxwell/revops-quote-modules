import type { FieldValues, TokenFieldValue } from "./fields";

export { fields } from "./fields";

type CrmRecord = Record<string, unknown> | null;

/**
 * `objects` carries the records the quote already knows about, so most tokens
 * resolve with no configuration. `fetched` holds the extra properties the
 * editor asked for by name, re-read with `crm_object` for cases where the quote
 * context turns out to be sparse.
 */
interface HublData {
  objects: {
    contact: CrmRecord;
    company: CrmRecord;
    deal: CrmRecord;
    quote: CrmRecord;
    billingContact: CrmRecord;
    billingCompany: CrmRecord;
  };
  fetched: {
    contact: CrmRecord;
    company: CrmRecord;
    deal: CrmRecord;
  };
  contactId: string | number | null;
  companyId: string | number | null;
  dealId: string | number | null;
  isQuoteBlueprint: boolean;
  isInEditor: boolean;
}

interface Props {
  fieldValues: FieldValues;
  hublData: HublData;
}

type Namespace = keyof HublData["objects"];

/** Token prefixes, and the spellings people reach for, mapped to a record. */
const NAMESPACE_ALIASES: Record<string, Namespace> = {
  contact: "contact",
  company: "company",
  deal: "deal",
  quote: "quote",
  billing_contact: "billingContact",
  billingcontact: "billingContact",
  billing_company: "billingCompany",
  billingcompany: "billingCompany",
};

/** Namespaces that `crm_object` can re-read. */
const FETCHABLE: Partial<Record<Namespace, keyof HublData["fetched"]>> = {
  contact: "contact",
  company: "company",
  deal: "deal",
};

const COMMON_LABELS: Record<string, string> = {
  firstname: "First name",
  lastname: "Last name",
  email: "Email",
  phone: "Phone",
  mobilephone: "Mobile phone",
  jobtitle: "Job title",
  company: "Company",
  website: "Website",
  address: "Address",
  city: "City",
  state: "State/Region",
  zip: "Postal code",
  country: "Country",
  name: "Name",
  domain: "Domain",
  dealname: "Deal name",
  amount: "Amount",
  closedate: "Close date",
  hs_title: "Quote title",
  hs_quote_number: "Quote number",
  hs_expiration_date: "Expires",
};

/** Stand-in values so quote templates preview with realistic content. */
const BLUEPRINT_PLACEHOLDERS: Partial<
  Record<Namespace, Record<string, string>>
> = {
  contact: {
    firstname: "Jordan",
    lastname: "Ellis",
    email: "jordan.ellis@example.com",
    phone: "(555) 010-1234",
    jobtitle: "Director of Operations",
  },
  company: {
    name: "Acme Corp",
    domain: "acme.com",
    city: "Boston",
    state: "MA",
    country: "United States",
  },
  deal: { dealname: "Acme — Platform rollout", amount: "10,000" },
  quote: { hs_title: "Platform rollout", hs_quote_number: "20260818-000000" },
};

function humanizeLabel(property: string): string {
  if (COMMON_LABELS[property]) {
    return COMMON_LABELS[property];
  }
  const spaced = property.replace(/^hs_/, "").replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return "";
  }
  if (Array.isArray(raw)) {
    return raw
      .filter((entry) => entry !== null && entry !== undefined && entry !== "")
      .join(", ");
  }
  if (typeof raw === "boolean") {
    return raw ? "Yes" : "No";
  }
  if (typeof raw === "object") {
    return "";
  }
  return String(raw).trim();
}

interface ParsedToken {
  namespace: Namespace;
  property: string;
}

/**
 * `contact.firstname` -> contact / firstname. A bare `firstname` reads from the
 * contact, which keeps the shorthand working. A `template_data.` prefix is
 * tolerated because that is what the legacy quote variables used.
 */
function parseToken(raw: string): ParsedToken | null {
  const text = raw.trim().replace(/^template_data\./i, "");
  if (!text) {
    return null;
  }

  const dot = text.indexOf(".");
  if (dot > 0) {
    const namespace = NAMESPACE_ALIASES[text.slice(0, dot).toLowerCase()];
    if (namespace) {
      const property = text.slice(dot + 1).trim();
      return property ? { namespace, property } : null;
    }
  }

  return { namespace: "contact", property: text };
}

/**
 * Returns undefined when the property is absent from the record entirely, which
 * is what lets callers tell an unknown token apart from an empty one.
 */
function resolveParsed(
  parsed: ParsedToken,
  hublData: HublData,
): string | undefined {
  const { namespace, property } = parsed;

  if (hublData.isQuoteBlueprint) {
    return BLUEPRINT_PLACEHOLDERS[namespace]?.[property] ?? "Sample value";
  }

  const fetchKey = FETCHABLE[namespace];
  if (fetchKey) {
    const fetched = formatValue(hublData.fetched?.[fetchKey]?.[property]);
    if (fetched) {
      return fetched;
    }
  }

  const base = hublData.objects?.[namespace];
  if (base && Object.prototype.hasOwnProperty.call(base, property)) {
    return formatValue(base[property]);
  }

  return undefined;
}

function resolveToken(raw: string, hublData: HublData): string | undefined {
  const parsed = parseToken(raw);
  return parsed ? resolveParsed(parsed, hublData) : undefined;
}

/**
 * CRM values are escaped before being spliced into the editor's HTML so a stray
 * angle bracket in a record cannot inject markup into the published quote.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SQUARE_TOKEN = /\[\s*([A-Za-z0-9_.]+)\s*\]/g;
const CURLY_TOKEN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

/**
 * An unresolved token stays visible while editing so the author notices the
 * typo, but is dropped on the published quote so a buyer never sees a raw
 * `[contact.firstname]` in their own document.
 */
function applyTokens(html: string, hublData: HublData): string {
  const substitute = (match: string, rawToken: string) => {
    const value = resolveToken(rawToken, hublData);
    if (value !== undefined) {
      return escapeHtml(value);
    }
    return hublData.isInEditor ? match : "";
  };

  return html
    .replace(SQUARE_TOKEN, substitute)
    .replace(CURLY_TOKEN, substitute);
}

type ResolvedSource = "resolved" | "fallback text" | "not found" | "empty";

interface ResolvedRow {
  key: string;
  token: string;
  label: string;
  value: string;
  source: ResolvedSource;
}

function resolveRows(
  fieldValues: FieldValues,
  hublData: HublData,
): ResolvedRow[] {
  const rows = fieldValues.tokens ?? [];

  return rows.reduce<ResolvedRow[]>(
    (accumulated, row: TokenFieldValue, index) => {
      const raw = row.token?.trim();
      if (!raw) {
        return accumulated;
      }

      const parsed = parseToken(raw);
      const resolved = parsed ? resolveParsed(parsed, hublData) : undefined;
      const label =
        row.labelOverride?.trim() ||
        (parsed ? humanizeLabel(parsed.property) : raw);

      let value = "";
      let source: ResolvedSource = "not found";

      if (resolved) {
        value = resolved;
        source = "resolved";
      } else if (row.fallback?.trim()) {
        value = row.fallback.trim();
        source = "fallback text";
      } else if (resolved === "") {
        source = "empty";
      }

      accumulated.push({
        key: `${raw}-${index}`,
        token: raw,
        label,
        value,
        source,
      });
      return accumulated;
    },
    [],
  );
}

function DebugPanel({
  hublData,
  rows,
  message,
  isTextMode,
}: {
  hublData: HublData;
  rows: ResolvedRow[];
  message: string;
  isTextMode: boolean;
}) {
  const tokensInText = Array.from(
    new Set(
      Array.from(message.matchAll(SQUARE_TOKEN)).map((match) =>
        match[1].trim(),
      ),
    ),
  );

  const namespaces: Namespace[] = [
    "contact",
    "company",
    "deal",
    "quote",
    "billingContact",
    "billingCompany",
  ];

  const box = {
    marginTop: "calc(var(--spacing-unit) * 2)",
    padding: "calc(var(--spacing-unit) * 1.5)",
    border: "1px dashed #b0b8c4",
    borderRadius: 4,
    fontSize: "0.8em",
    lineHeight: 1.5,
    color: "#516f90",
  } as const;

  return (
    <div style={box}>
      <strong
        style={{
          display: "block",
          marginBottom: "calc(var(--spacing-unit) * 0.5)",
        }}
      >
        Contact Token — troubleshooting
      </strong>

      <div>
        Records found — contact: {hublData.contactId ?? "none"} · company:{" "}
        {hublData.companyId ?? "none"} · deal: {hublData.dealId ?? "none"}
        {hublData.isQuoteBlueprint ? " · rendering template placeholders" : ""}
      </div>

      {isTextMode && tokensInText.length > 0 ? (
        <div style={{ marginTop: "calc(var(--spacing-unit) * 0.5)" }}>
          Tokens in your text:
          <ul style={{ margin: "0.25em 0 0 0", paddingLeft: "1.2em" }}>
            {tokensInText.map((token) => {
              const value = resolveToken(token, hublData);
              return (
                <li key={token}>
                  <code>[{token}]</code>{" "}
                  {value === undefined
                    ? "— NOT FOUND on that record"
                    : value === ""
                      ? "— empty on that record"
                      : `→ ${value}`}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!isTextMode && rows.length > 0 ? (
        <div style={{ marginTop: "calc(var(--spacing-unit) * 0.5)" }}>
          Listed fields:
          <ul style={{ margin: "0.25em 0 0 0", paddingLeft: "1.2em" }}>
            {rows.map((row) => (
              <li key={row.key}>
                <code>[{row.token}]</code> — {row.source}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ marginTop: "calc(var(--spacing-unit) * 0.5)" }}>
        Properties available on each record:
        <ul style={{ margin: "0.25em 0 0 0", paddingLeft: "1.2em" }}>
          {namespaces.map((namespace) => {
            const record = hublData.objects?.[namespace];
            const keys = record ? Object.keys(record).sort() : [];
            return (
              <li key={namespace} style={{ marginBottom: "0.35em" }}>
                <strong>{namespace}</strong>{" "}
                {keys.length === 0 ? (
                  "— no record on this quote"
                ) : (
                  <code style={{ wordBreak: "break-word" }}>
                    {keys.join(", ")}
                  </code>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ marginTop: "calc(var(--spacing-unit) * 0.5)" }}>
        Anything missing above can be pulled in with &quot;Extra properties to
        fetch&quot;. Turn this off before publishing.
      </div>
    </div>
  );
}

export function Component({ fieldValues, hublData }: Props) {
  const {
    heading,
    displayMode = "text",
    message = "",
    layout = "table",
    showLabels = true,
    hideEmpty = true,
    debug = false,
    styles,
  } = fieldValues;

  const isTextMode = displayMode === "text";
  const rows = resolveRows(fieldValues, hublData);
  const visible = hideEmpty ? rows.filter((row) => row.value) : rows;

  const labelStyle = {
    color: styles?.labelColor?.css,
    fontWeight: 600,
  } as const;
  const valueStyle = { color: styles?.valueColor?.css } as const;
  const rowBorder = styles?.showDividers
    ? "1px solid rgba(0, 0, 0, 0.08)"
    : "none";

  return (
    <div
      style={{
        backgroundColor: styles?.backgroundColor?.css,
        padding:
          "calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 2.5)",
        lineHeight: 1.55,
      }}
    >
      {heading ? (
        <h3 style={{ margin: "0 0 calc(var(--spacing-unit) * 1.5) 0" }}>
          {heading}
        </h3>
      ) : null}

      {isTextMode ? (
        <div
          // Markup authored by the quote builder in the sidebar rich text
          // field; substituted CRM values are escaped by applyTokens.
          dangerouslySetInnerHTML={{ __html: applyTokens(message, hublData) }}
        />
      ) : null}

      {!isTextMode && visible.length === 0 && hublData.isInEditor ? (
        <p style={{ margin: 0, fontStyle: "italic", opacity: 0.7 }}>
          No fields to show yet. Add tokens under &quot;Fields to display&quot;.
        </p>
      ) : null}

      {isTextMode ? null : layout === "table" ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key}>
                {showLabels ? (
                  <th
                    scope="row"
                    style={{
                      ...labelStyle,
                      textAlign: "left",
                      verticalAlign: "top",
                      padding:
                        "calc(var(--spacing-unit) * 0.5) calc(var(--spacing-unit) * 1.5) calc(var(--spacing-unit) * 0.5) 0",
                      borderBottom: rowBorder,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.label}
                  </th>
                ) : null}
                <td
                  style={{
                    ...valueStyle,
                    verticalAlign: "top",
                    padding: "calc(var(--spacing-unit) * 0.5) 0",
                    borderBottom: rowBorder,
                    width: "100%",
                  }}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          {visible.map((row) => (
            <div
              key={row.key}
              style={{
                display: layout === "inline" ? "flex" : "block",
                gap:
                  layout === "inline"
                    ? "calc(var(--spacing-unit) * 0.5)"
                    : undefined,
                padding: "calc(var(--spacing-unit) * 0.5) 0",
                borderBottom: rowBorder,
              }}
            >
              {showLabels ? (
                <span
                  style={{
                    ...labelStyle,
                    display: layout === "inline" ? "inline" : "block",
                  }}
                >
                  {row.label}
                  {layout === "inline" ? ":" : ""}
                </span>
              ) : null}
              <span
                style={{
                  ...valueStyle,
                  display: layout === "inline" ? "inline" : "block",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {debug ? (
        <DebugPanel
          hublData={hublData}
          rows={rows}
          message={message}
          isTextMode={isTextMode}
        />
      ) : null}
    </div>
  );
}

export const meta = {
  label: "Contact Token",
  content_types: ["QUOTE", "QUOTE_BLUEPRINT"],
};

/**
 * Deliberately loop-free. Property lists come from plain comma-separated text
 * fields so this template relies only on documented HubL behaviour: no
 * accumulator objects, no {% do %} mutation, no filters beyond attribute access.
 */
export const hublDataTemplate = `
  {% set buyerContacts = quoteTemplateContext.buyerContacts %}
  {% set requestedIndex = (module.contactIndex if module.contactIndex else 1) - 1 %}
  {% set buyerContact = buyerContacts[requestedIndex] if buyerContacts else null %}
  {% set contact = quoteTemplateContext.billingContact if module.contactSource == "billing" else buyerContact %}
  {% set company = quoteTemplateContext.buyerCompany %}
  {% set deal = quoteTemplateContext.deal %}

  {# crm_object is capped at 10 calls per rendered page, so each of these only
     runs when the editor actually named properties to fetch. #}
  {% if contact.hs_object_id and module.extraContactProperties %}
    {% set fetchedContact = crm_object("contact", contact.hs_object_id, module.extraContactProperties) %}
  {% endif %}
  {% if company.hs_object_id and module.extraCompanyProperties %}
    {% set fetchedCompany = crm_object("company", company.hs_object_id, module.extraCompanyProperties) %}
  {% endif %}
  {% if deal.hs_object_id and module.extraDealProperties %}
    {% set fetchedDeal = crm_object("deal", deal.hs_object_id, module.extraDealProperties) %}
  {% endif %}

  {% set hublData = {
    "objects": {
      "contact": contact if contact else null,
      "company": company if company else null,
      "deal": deal if deal else null,
      "quote": quoteTemplateContext.quote,
      "billingContact": quoteTemplateContext.billingContact,
      "billingCompany": quoteTemplateContext.billingCompany
    },
    "fetched": {
      "contact": fetchedContact if fetchedContact else null,
      "company": fetchedCompany if fetchedCompany else null,
      "deal": fetchedDeal if fetchedDeal else null
    },
    "contactId": contact.hs_object_id if contact else null,
    "companyId": company.hs_object_id if company else null,
    "dealId": deal.hs_object_id if deal else null,
    "isQuoteBlueprint": isQuoteBlueprint,
    "isInEditor": is_in_editor
  } %}
`;
