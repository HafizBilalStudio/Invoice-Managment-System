SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'pdf_background_color'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE user_profiles
     ADD COLUMN pdf_background_color VARCHAR(7) NULL AFTER bank_address,
     ADD COLUMN pdf_text_color VARCHAR(7) NULL AFTER pdf_background_color,
     ADD COLUMN pdf_heading_background_color VARCHAR(7) NULL AFTER pdf_text_color',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'pdf_background_color_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE invoices
     ADD COLUMN pdf_background_color_snapshot VARCHAR(7) NULL AFTER payout_notes_snapshot,
     ADD COLUMN pdf_text_color_snapshot VARCHAR(7) NULL AFTER pdf_background_color_snapshot,
     ADD COLUMN pdf_heading_background_color_snapshot VARCHAR(7) NULL AFTER pdf_text_color_snapshot',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
