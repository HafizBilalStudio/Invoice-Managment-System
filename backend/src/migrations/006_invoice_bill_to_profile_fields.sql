ALTER TABLE user_profiles
  ADD COLUMN bill_to_name VARCHAR(255) NULL AFTER email_for_remittance,
  ADD COLUMN bill_to_address_line1 VARCHAR(255) NULL AFTER bill_to_name,
  ADD COLUMN bill_to_address_line2 VARCHAR(255) NULL AFTER bill_to_address_line1,
  ADD COLUMN bill_to_city VARCHAR(100) NULL AFTER bill_to_address_line2,
  ADD COLUMN bill_to_state VARCHAR(100) NULL AFTER bill_to_city,
  ADD COLUMN bill_to_postal_code VARCHAR(50) NULL AFTER bill_to_state,
  ADD COLUMN bill_to_country VARCHAR(100) NULL AFTER bill_to_postal_code,
  ADD COLUMN bill_to_phone VARCHAR(100) NULL AFTER bill_to_country;

ALTER TABLE invoices
  ADD COLUMN bill_to_name_snapshot VARCHAR(255) NULL AFTER payee_country_snapshot,
  ADD COLUMN bill_to_address_line1_snapshot VARCHAR(255) NULL AFTER bill_to_name_snapshot,
  ADD COLUMN bill_to_address_line2_snapshot VARCHAR(255) NULL AFTER bill_to_address_line1_snapshot,
  ADD COLUMN bill_to_city_snapshot VARCHAR(100) NULL AFTER bill_to_address_line2_snapshot,
  ADD COLUMN bill_to_state_snapshot VARCHAR(100) NULL AFTER bill_to_city_snapshot,
  ADD COLUMN bill_to_postal_code_snapshot VARCHAR(50) NULL AFTER bill_to_state_snapshot,
  ADD COLUMN bill_to_country_snapshot VARCHAR(100) NULL AFTER bill_to_postal_code_snapshot,
  ADD COLUMN bill_to_phone_snapshot VARCHAR(100) NULL AFTER bill_to_country_snapshot;
