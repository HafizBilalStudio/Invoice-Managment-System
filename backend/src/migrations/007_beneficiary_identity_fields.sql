ALTER TABLE user_profiles
  ADD COLUMN beneficiary_name VARCHAR(255) NULL AFTER payment_method,
  ADD COLUMN beneficiary_email VARCHAR(255) NULL AFTER beneficiary_country;
