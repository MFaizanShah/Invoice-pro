-- OPTIONAL. Only run this if Hause Realty is the company using the app.
-- It fills Settings with the values from invoice 00014. Run after schema.sql.
update public.settings set
  company_name = 'Hause Realty',
  company_legal_line = 'KRYSALIS GLOBAL PTY LTD trading as Hause Realty',
  tax_number_label = 'ABN',
  company_tax_number = '32 621 662 397',
  company_address = 'Level 1, Suite 5, 166-168 Grange Road, Flinders Park SA 5025',
  company_licence = 'RLA 353 444',
  tax_label = 'GST', tax_rate = 10, currency = 'AUD',
  invoice_prefix = '', number_padding = 5, next_number = 15,
  document_title = 'Tax invoice', document_subtitle = 'Professional Service Invoice',
  payment_method_title = 'By Direct Debit / Bank Transfer',
  bank_details = E'Account name: Hause Realty Business Account\nBSB: 105-096\nAccount number: 085 790 940',
  default_terms = 'Payment is to be made to the Hause Realty business account shown above.',
  accent_color = '#B08A2E',
  show_freight = true;
