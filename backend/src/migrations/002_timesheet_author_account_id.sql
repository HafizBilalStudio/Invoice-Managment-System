SET @author_account_id_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'timesheet_entries'
    AND COLUMN_NAME = 'author_account_id'
);

SET @author_account_id_add_sql = IF(
  @author_account_id_column_exists = 0,
  'ALTER TABLE timesheet_entries ADD COLUMN author_account_id VARCHAR(255) NULL AFTER contractor_user_id',
  'SELECT 1'
);
PREPARE author_account_id_add_stmt FROM @author_account_id_add_sql;
EXECUTE author_account_id_add_stmt;
DEALLOCATE PREPARE author_account_id_add_stmt;

SET @author_account_id_index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'timesheet_entries'
    AND INDEX_NAME = 'idx_timesheet_author_account_date'
);

SET @author_account_id_index_sql = IF(
  @author_account_id_index_exists = 0,
  'CREATE INDEX idx_timesheet_author_account_date ON timesheet_entries (author_account_id, work_date)',
  'SELECT 1'
);
PREPARE author_account_id_index_stmt FROM @author_account_id_index_sql;
EXECUTE author_account_id_index_stmt;
DEALLOCATE PREPARE author_account_id_index_stmt;

UPDATE timesheet_entries
SET author_account_id = COALESCE(
  JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.author.accountId')),
  JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.author.accountID')),
  JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.worker.accountId')),
  JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.worker.accountID'))
)
WHERE author_account_id IS NULL;
