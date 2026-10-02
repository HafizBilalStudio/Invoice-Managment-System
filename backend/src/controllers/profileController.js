const db = require('../config/db');
const { getUserById } = require('../services/userService');
const {
  DEFAULT_INVOICE_NUMBER_FORMAT,
  deriveLast4,
  getUserProfileRow,
  mapProfileResponse,
  nullIfBlank,
  sanitizeHexColor,
  validateInvoiceNumberFormat
} = require('../services/profileService');
const { listUsersForManagerFlag, setProjectManagerFlag } = require('../services/userService');

const getProfile = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await getUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const profileRow = await getUserProfileRow(req.user.id);
  return res.json(mapProfileResponse(user, profileRow));
};

const updateProfile = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const {
    hourlyRateUsd,
    paymentMethod,
    beneficiaryName,
    beneficiaryAddressLine1,
    beneficiaryAddressLine2,
    beneficiaryCity,
    beneficiaryState,
    beneficiaryPostalCode,
    beneficiaryCountry,
    beneficiaryEmail,
    emailForRemittance,
    billToName,
    billToAddressLine1,
    billToAddressLine2,
    billToCity,
    billToState,
    billToPostalCode,
    billToCountry,
    billToPhone,
    bankAccountTitle,
    bankRoutingNumber,
    bankAccountNumber,
    bankAccountType,
    bankName,
    bankAddress,
    bankAddressLine1,
    bankAddressLine2,
    bankCity,
    bankState,
    bankPostalCode,
    bankCountry,
    pdfBackgroundColor,
    pdfTextColor,
    pdfHeadingBackgroundColor,
    invoiceNumberFormat,
    notes,
    effectiveFrom
  } = req.body || {};

  const hourlyRateValue =
    hourlyRateUsd === '' || hourlyRateUsd === null || hourlyRateUsd === undefined
      ? null
      : Number(hourlyRateUsd);

  if (hourlyRateValue !== null && (!Number.isFinite(hourlyRateValue) || hourlyRateValue < 0)) {
    return res.status(400).json({ message: 'hourlyRateUsd must be a valid non-negative number' });
  }

  const existingProfile = await getUserProfileRow(req.user.id);
  const nextRoutingNumber =
    bankRoutingNumber === '' || bankRoutingNumber === undefined
      ? existingProfile?.bank_routing_number || null
      : nullIfBlank(bankRoutingNumber);
  const nextAccountNumber =
    bankAccountNumber === '' || bankAccountNumber === undefined
      ? existingProfile?.bank_account_number || null
      : nullIfBlank(bankAccountNumber);
  const nextBankAddressLine1 = nullIfBlank(bankAddressLine1) || nullIfBlank(bankAddress);
  const nextEffectiveFrom = nullIfBlank(effectiveFrom);
  const nextPdfBackgroundColor = sanitizeHexColor(pdfBackgroundColor) || '#FFFFFF';
  const nextPdfTextColor = sanitizeHexColor(pdfTextColor) || '#0F172A';
  const nextPdfHeadingBackgroundColor = sanitizeHexColor(pdfHeadingBackgroundColor) || '#E2E8F0';
  const invoiceNumberFormatValidation = validateInvoiceNumberFormat(invoiceNumberFormat);

  if (pdfBackgroundColor !== undefined && pdfBackgroundColor !== '' && !sanitizeHexColor(pdfBackgroundColor)) {
    return res.status(400).json({ message: 'pdfBackgroundColor must be a valid hex color like #FFFFFF' });
  }
  if (pdfTextColor !== undefined && pdfTextColor !== '' && !sanitizeHexColor(pdfTextColor)) {
    return res.status(400).json({ message: 'pdfTextColor must be a valid hex color like #0F172A' });
  }
  if (
    pdfHeadingBackgroundColor !== undefined &&
    pdfHeadingBackgroundColor !== '' &&
    !sanitizeHexColor(pdfHeadingBackgroundColor)
  ) {
    return res.status(400).json({ message: 'pdfHeadingBackgroundColor must be a valid hex color like #E2E8F0' });
  }
  if (!invoiceNumberFormatValidation.valid) {
    return res.status(400).json({ message: invoiceNumberFormatValidation.message });
  }

  await db.query(
    `INSERT INTO user_profiles
      (user_id, hourly_rate_usd, currency, payment_method, beneficiary_name, beneficiary_address_line1,
       beneficiary_address_line2, beneficiary_city, beneficiary_state, beneficiary_postal_code,
       beneficiary_country, beneficiary_email, email_for_remittance, bill_to_name, bill_to_address_line1,
       bill_to_address_line2, bill_to_city, bill_to_state, bill_to_postal_code, bill_to_country,
       bill_to_phone, bank_account_title, bank_routing_number, bank_account_number,
       bank_account_last4, bank_account_type, bank_name, bank_address, bank_address_line1,
       bank_address_line2, bank_city, bank_state, bank_postal_code, bank_country,
       pdf_background_color, pdf_text_color, pdf_heading_background_color, invoice_number_format,
       is_default_payout_account, notes, effective_from)
     VALUES (?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
      hourly_rate_usd = VALUES(hourly_rate_usd),
      currency = 'USD',
      payment_method = VALUES(payment_method),
      beneficiary_name = VALUES(beneficiary_name),
      beneficiary_address_line1 = VALUES(beneficiary_address_line1),
      beneficiary_address_line2 = VALUES(beneficiary_address_line2),
      beneficiary_city = VALUES(beneficiary_city),
      beneficiary_state = VALUES(beneficiary_state),
      beneficiary_postal_code = VALUES(beneficiary_postal_code),
      beneficiary_country = VALUES(beneficiary_country),
      beneficiary_email = VALUES(beneficiary_email),
      email_for_remittance = VALUES(email_for_remittance),
      bill_to_name = VALUES(bill_to_name),
      bill_to_address_line1 = VALUES(bill_to_address_line1),
      bill_to_address_line2 = VALUES(bill_to_address_line2),
      bill_to_city = VALUES(bill_to_city),
      bill_to_state = VALUES(bill_to_state),
      bill_to_postal_code = VALUES(bill_to_postal_code),
      bill_to_country = VALUES(bill_to_country),
      bill_to_phone = VALUES(bill_to_phone),
      bank_account_title = VALUES(bank_account_title),
      bank_routing_number = VALUES(bank_routing_number),
      bank_account_number = VALUES(bank_account_number),
      bank_account_last4 = VALUES(bank_account_last4),
      bank_account_type = VALUES(bank_account_type),
      bank_name = VALUES(bank_name),
      bank_address = VALUES(bank_address),
      bank_address_line1 = VALUES(bank_address_line1),
      bank_address_line2 = VALUES(bank_address_line2),
      bank_city = VALUES(bank_city),
      bank_state = VALUES(bank_state),
      bank_postal_code = VALUES(bank_postal_code),
      bank_country = VALUES(bank_country),
      pdf_background_color = VALUES(pdf_background_color),
      pdf_text_color = VALUES(pdf_text_color),
      pdf_heading_background_color = VALUES(pdf_heading_background_color),
      invoice_number_format = VALUES(invoice_number_format),
      is_default_payout_account = VALUES(is_default_payout_account),
      notes = VALUES(notes),
      effective_from = VALUES(effective_from)`,
    [
      req.user.id,
      hourlyRateValue,
      nullIfBlank(paymentMethod),
      nullIfBlank(beneficiaryName),
      nullIfBlank(beneficiaryAddressLine1),
      nullIfBlank(beneficiaryAddressLine2),
      nullIfBlank(beneficiaryCity),
      nullIfBlank(beneficiaryState),
      nullIfBlank(beneficiaryPostalCode),
      nullIfBlank(beneficiaryCountry) || 'United States',
      nullIfBlank(beneficiaryEmail),
      nullIfBlank(emailForRemittance),
      nullIfBlank(billToName),
      nullIfBlank(billToAddressLine1),
      nullIfBlank(billToAddressLine2),
      nullIfBlank(billToCity),
      nullIfBlank(billToState),
      nullIfBlank(billToPostalCode),
      nullIfBlank(billToCountry) || 'United States',
      nullIfBlank(billToPhone),
      nullIfBlank(bankAccountTitle),
      nextRoutingNumber,
      nextAccountNumber,
      deriveLast4(nextAccountNumber),
      nullIfBlank(bankAccountType),
      nullIfBlank(bankName),
      nextBankAddressLine1,
      nextBankAddressLine1,
      nullIfBlank(bankAddressLine2),
      nullIfBlank(bankCity),
      nullIfBlank(bankState),
      nullIfBlank(bankPostalCode),
      nullIfBlank(bankCountry) || 'United States',
      nextPdfBackgroundColor,
      nextPdfTextColor,
      nextPdfHeadingBackgroundColor,
      invoiceNumberFormatValidation.normalized || DEFAULT_INVOICE_NUMBER_FORMAT,
      nullIfBlank(notes),
      nextEffectiveFrom
    ]
  );

  await db.query(
    `INSERT INTO contractors (user_id, hourly_rate, currency)
     VALUES (?, ?, 'USD')
     ON DUPLICATE KEY UPDATE
      hourly_rate = VALUES(hourly_rate),
      currency = 'USD'`,
    [req.user.id, hourlyRateValue]
  );

  await db.query(
    'INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)',
    [
      req.user.id,
      'PROFILE_UPDATED',
      JSON.stringify({
        hourlyRateUsd: hourlyRateValue,
        paymentMethod: nullIfBlank(paymentMethod),
        beneficiaryName: nullIfBlank(beneficiaryName),
        beneficiaryEmail: nullIfBlank(beneficiaryEmail),
        billToName: nullIfBlank(billToName),
        bankAccountLast4: deriveLast4(nextAccountNumber),
        pdfBackgroundColor: nextPdfBackgroundColor,
        pdfTextColor: nextPdfTextColor,
        pdfHeadingBackgroundColor: nextPdfHeadingBackgroundColor,
        invoiceNumberFormat: invoiceNumberFormatValidation.normalized || DEFAULT_INVOICE_NUMBER_FORMAT
      })
    ]
  );

  const user = await getUserById(req.user.id);
  const profileRow = await getUserProfileRow(req.user.id);
  return res.json(mapProfileResponse(user, profileRow));
};

const listManagerCandidates = async (req, res) => {
  const users = await listUsersForManagerFlag();
  return res.json({ users });
};

const updateManagerCandidate = async (req, res) => {
  const targetUserId = Number(req.params.userId);
  const isProjectManager = Boolean(req.body?.isProjectManager);

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  await setProjectManagerFlag({ userId: targetUserId, isProjectManager });

  await db.query('INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)', [
    req.user.id,
    'PROJECT_MANAGER_FLAG_UPDATED',
    JSON.stringify({ targetUserId, isProjectManager })
  ]);

  return res.json({ message: 'Project manager flag updated' });
};

module.exports = {
  getProfile,
  updateProfile,
  listManagerCandidates,
  updateManagerCandidate
};
