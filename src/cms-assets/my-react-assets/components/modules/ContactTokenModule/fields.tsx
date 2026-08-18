import {
  ModuleFields,
  FieldGroup,
  RepeatedFieldGroup,
  TextField,
  ChoiceField,
  RichTextField,
  BooleanField,
  NumberField,
  ColorField,
} from "@hubspot/cms-components/fields";

export interface TokenFieldValue {
  token?: string;
  labelOverride?: string;
  fallback?: string;
}

export interface FieldValues {
  heading?: string;
  displayMode?: "text" | "list";
  message?: string;
  tokens?: TokenFieldValue[];
  contactSource?: "buyer" | "billing";
  contactIndex?: number;
  extraContactProperties?: string;
  extraCompanyProperties?: string;
  extraDealProperties?: string;
  layout?: "table" | "stacked" | "inline";
  showLabels?: boolean;
  hideEmpty?: boolean;
  debug?: boolean;
  styles?: {
    backgroundColor?: { css?: string };
    labelColor?: { css?: string };
    valueColor?: { css?: string };
    showDividers?: boolean;
  };
}

export const fields = (
  <ModuleFields>
    <TextField
      name="heading"
      label="Heading"
      default=""
      placeholder="e.g. Prepared for"
      helpText="Optional. Leave blank to hide the heading."
    />

    <ChoiceField
      name="displayMode"
      label="Display as"
      display="select"
      default="text"
      choices={[
        ["text", "Text with tokens inside it"],
        ["list", "A list of labelled fields"],
      ]}
    />

    <RichTextField
      name="message"
      label="Text"
      default="<p>Hi [contact.firstname], this quote was prepared for [company.name].</p>"
      helpText="Used in text mode. Write [contact.firstname], [company.name], [deal.dealname] or [quote.hs_title]. A token with no prefix, like [firstname], reads from the contact."
    />

    <RepeatedFieldGroup
      name="tokens"
      label="Fields to display"
      occurrence={{ min: 0, max: 30, sorting_label_field: "token" }}
      helpText="Used in list mode. One row per value to show."
      default={[
        { token: "contact.firstname", labelOverride: "", fallback: "" },
        { token: "contact.email", labelOverride: "", fallback: "" },
        { token: "company.name", labelOverride: "", fallback: "" },
      ]}
    >
      <TextField
        name="token"
        label="Token"
        default=""
        placeholder="contact.firstname"
        helpText="object.property — for example contact.jobtitle, company.domain, deal.dealname, quote.hs_title."
      />
      <TextField
        name="labelOverride"
        label="Label"
        default=""
        helpText="Leave blank to derive a label from the property name."
      />
      <TextField name="fallback" label="Shown when empty" default="" />
    </RepeatedFieldGroup>

    <ChoiceField
      name="contactSource"
      label="[contact] refers to"
      display="select"
      default="buyer"
      choices={[
        ["buyer", "The buyer contact on the quote"],
        ["billing", "The billing contact on the quote"],
      ]}
    />

    <NumberField
      name="contactIndex"
      label="Buyer contact number"
      default={1}
      min={1}
      step={1}
      format="INTEGER"
      helpText="1 = the first buyer contact. Only applies when [contact] refers to the buyer contact."
    />

    <TextField
      name="extraContactProperties"
      label="Extra contact properties to fetch"
      default=""
      placeholder="my_custom_property,another_property"
      helpText="Only needed if a token reports 'not found'. Comma-separated internal names, re-read from the contact record."
    />

    <TextField
      name="extraCompanyProperties"
      label="Extra company properties to fetch"
      default=""
      placeholder="my_custom_property"
      helpText="Comma-separated internal names, re-read from the company record."
    />

    <TextField
      name="extraDealProperties"
      label="Extra deal properties to fetch"
      default=""
      placeholder="my_custom_property"
      helpText="Comma-separated internal names, re-read from the deal record."
    />

    <BooleanField
      name="debug"
      label="Show troubleshooting details"
      display="toggle"
      default={false}
      helpText="Lists every property available on each record and what each token resolved to. Turn off before publishing."
    />

    <ChoiceField
      name="layout"
      label="List layout"
      display="select"
      default="table"
      choices={[
        ["table", "Two columns (label | value)"],
        ["stacked", "Stacked (label above value)"],
        ["inline", "Inline (label: value)"],
      ]}
    />

    <BooleanField
      name="showLabels"
      label="Show labels"
      display="toggle"
      default={true}
    />

    <BooleanField
      name="hideEmpty"
      label="Hide fields that have no value"
      display="toggle"
      default={true}
    />

    <FieldGroup name="styles" label="Styles" tab="STYLE">
      <ColorField
        name="backgroundColor"
        label="Background color"
        showOpacity={true}
      />
      <ColorField name="labelColor" label="Label color" showOpacity={true} />
      <ColorField name="valueColor" label="Value color" showOpacity={true} />
      <BooleanField
        name="showDividers"
        label="Show divider lines"
        display="toggle"
        default={false}
      />
    </FieldGroup>
  </ModuleFields>
);
