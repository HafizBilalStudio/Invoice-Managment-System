SET @invoice_number_format_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_profiles'
    AND COLUMN_NAME = 'invoice_number_format'
);

SET @invoice_number_format_sql = IF(
  @invoice_number_format_exists = 0,
  'ALTER TABLE user_profiles ADD COLUMN invoice_number_format VARCHAR(255) NULL AFTER pdf_heading_background_color',
  'SELECT 1'
);

PREPARE invoice_number_format_stmt FROM @invoice_number_format_sql;
EXECUTE invoice_number_format_stmt;
DEALLOCATE PREPARE invoice_number_format_stmt;

ALTER TABLE invoices
  MODIFY COLUMN invoice_number VARCHAR(255) NOT NULL;

UPDATE user_profiles
SET invoice_number_format = '{InvoiceCounter}-{AccountKey}'
WHERE invoice_number_format IS NULL OR TRIM(invoice_number_format) = '';
