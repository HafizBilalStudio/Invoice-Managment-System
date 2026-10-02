const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const pdfFolder = path.resolve(__dirname, '../../storage/pdfs');

if (!fs.existsSync(pdfFolder)) {
  fs.mkdirSync(pdfFolder, { recursive: true });
}

function formatDate(value, locale = 'en-US') {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function formatInvoiceDate(value, locale = 'en-US') {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function currency(value) {
  return Number(value || 0).toFixed(2);
}

function drawLabelValue(doc, x, y, label, value, options = {}) {
  const labelWidth = options.labelWidth || 95;
  const valueWidth = options.valueWidth || 140;
  const labelColor = options.labelColor || '#475569';
  const valueColor = options.valueColor || '#0f172a';

  doc.font('Helvetica-Bold').fontSize(9).fillColor(labelColor).text(label, x, y, {
    width: labelWidth
  });
  doc.font('Helvetica').fontSize(10).fillColor(valueColor).text(value || '-', x + labelWidth, y, {
    width: valueWidth
  });
}

function drawStackedLabelValue(doc, x, y, label, value, options = {}) {
  const width = options.width || 180;
  const labelGap = options.labelGap || 6;
  const labelColor = options.labelColor || '#475569';
  const valueColor = options.valueColor || '#0f172a';

  doc.font('Helvetica-Bold').fontSize(9).fillColor(labelColor).text(label, x, y, { width });
  doc.font('Helvetica').fontSize(10).fillColor(valueColor).text(value || '-', x, y + labelGap + 10, {
    width
  });
}

function buildPdfTheme(invoice) {
  const payout = invoice.payoutDetails || {};
  const textColor = payout.pdfTextColor || '#0F172A';

  return {
    backgroundColor: payout.pdfBackgroundColor || '#FFFFFF',
    textColor,
    headingBackgroundColor: payout.pdfHeadingBackgroundColor || '#E2E8F0',
    mutedTextColor: textColor,
    secondaryTextColor: textColor,
    lineColor: '#CBD5E1'
  };
}

const generateInvoicePdf = (invoice) => {
  const fileName = `invoice-${invoice.invoiceNumber}.pdf`;
  const filePath = path.join(pdfFolder, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    const payout = invoice.payoutDetails || {};
    const theme = buildPdfTheme(invoice);
    const accountDisplayValue = invoice.projectAccountNumber || invoice.projectNumber || '-';
    const payeeLines = [
      payout.payeeName || invoice.contractorName,
      payout.payeeAddressLine1,
      payout.payeeAddressLine2,
      [payout.payeeCity, payout.payeeState, payout.payeePostalCode].filter(Boolean).join(', '),
      payout.payeeCountry,
      payout.payeeEmail || payout.remittanceEmail || invoice.contractorEmail
    ].filter(Boolean);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(theme.backgroundColor);

    let y = 48;
    doc.font('Helvetica-Bold').fontSize(16).fillColor(theme.textColor).text(payeeLines[0] || 'Contractor', 48, y);
    y += 22;

    doc.font('Helvetica').fontSize(10).fillColor(theme.secondaryTextColor);
    for (const line of payeeLines.slice(1)) {
      doc.text(line, 48, y);
      y += 14;
    }

    doc.font('Helvetica-Bold').fontSize(24).fillColor(theme.textColor).text('INVOICE', 400, 48, { align: 'right' });
    drawLabelValue(doc, 340, 92, 'DATE', formatInvoiceDate(new Date()), {
      labelColor: theme.mutedTextColor,
      valueColor: theme.textColor
    });
    drawLabelValue(doc, 340, 110, 'INVOICE NO.', invoice.invoiceNumber, {
      labelColor: theme.mutedTextColor,
      valueColor: theme.textColor
    });

    doc.moveTo(48, 160).lineTo(547, 160).strokeColor(theme.lineColor).lineWidth(1).stroke();

    drawStackedLabelValue(
      doc,
      48,
      176,
      'BILL TO',
      payout.billToName || process.env.INVOICE_BILL_TO_NAME || 'Myemployer',
      { width: 170, labelColor: theme.mutedTextColor, valueColor: theme.textColor }
    );
    drawStackedLabelValue(
      doc,
      300,
      176,
      'PERIOD',
      `${formatDate(invoice.startDate)} To ${formatDate(invoice.endDate)}`,
      { width: 190, labelColor: theme.mutedTextColor, valueColor: theme.textColor }
    );

    const billToAddressLines = [
      payout.billToAddressLine1 || process.env.INVOICE_BILL_TO_ADDRESS_LINE1,
      payout.billToAddressLine2 || process.env.INVOICE_BILL_TO_ADDRESS_LINE2,
      [
        payout.billToCity || process.env.INVOICE_BILL_TO_CITY,
        payout.billToState || process.env.INVOICE_BILL_TO_STATE,
        payout.billToPostalCode || process.env.INVOICE_BILL_TO_POSTAL_CODE
      ]
        .filter(Boolean)
        .join(' '),
      payout.billToCountry || process.env.INVOICE_BILL_TO_COUNTRY,
      payout.billToPhone || process.env.INVOICE_BILL_TO_PHONE
    ].filter(Boolean);

    let billToY = 204;
    doc.font('Helvetica').fontSize(10).fillColor(theme.secondaryTextColor);
    for (const line of billToAddressLines) {
      doc.text(line, 48, billToY);
      billToY += 13;
    }

    const projectSectionTop = 274;
    doc.rect(48, projectSectionTop, 499, 24).fill(theme.headingBackgroundColor);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(theme.mutedTextColor).text('PROJECT', 56, projectSectionTop + 7, {
      width: 220
    });
    doc.text('ACCOUNT', 328, projectSectionTop + 7, {
      width: 150
    });

    doc.font('Helvetica').fontSize(10).fillColor(theme.textColor).text(invoice.projectName || '-', 48, projectSectionTop + 30, {
      width: 220
    });
    doc.text(accountDisplayValue, 320, projectSectionTop + 30, {
      width: 150
    });

    const tableTop = projectSectionTop + 88;
    const ticketX = 48;
    const hoursX = 475;
    doc.rect(48, tableTop, 499, 24).fill(theme.headingBackgroundColor);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(theme.textColor).text('TICKETS LIST', ticketX + 8, tableTop + 7);
    doc.text('HOURS', hoursX, tableTop + 7, { width: 50, align: 'right' });

    let rowY = tableTop + 30;
    const worklogs = Array.isArray(invoice.worklogs) ? invoice.worklogs : [];

    doc.font('Helvetica').fontSize(9).fillColor(theme.textColor);
    if (worklogs.length === 0) {
      doc.text('No project worklogs found.', ticketX + 8, rowY);
      rowY += 18;
    } else {
      for (const item of worklogs) {
        const title = [item.issueKey, item.issueSummary].filter(Boolean).join(' - ') || item.label || 'Worklog';
        const rowStartY = rowY;
        const titleHeight = doc.heightOfString(title, { width: 390 });
        doc.text(title, ticketX + 8, rowY, { width: 390 });
        rowY += Math.max(18, titleHeight + 2);
        doc.text(Number(item.quantity || 0).toFixed(2), hoursX, rowStartY, { width: 50, align: 'right' });
        doc.moveTo(48, rowY).lineTo(547, rowY).strokeColor(theme.lineColor).lineWidth(0.6).stroke();
        rowY += 8;
      }
    }

    const remarksTop = Math.max(rowY + 12, 610);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(theme.textColor).text('Remarks / Payment Instructions:', 48, remarksTop);

    const remarksLines = [
      payout.payoutNotes ? `Instructions: ${payout.payoutNotes}` : null,
      payout.bankAccountTitle ? `Account holder: ${payout.bankAccountTitle}` : null,
      payout.bankRoutingNumber ? `ACH and Wire routing number: ${payout.bankRoutingNumber}` : null,
      payout.bankAccountNumber ? `Account number: ${payout.bankAccountNumber}` : null,
      payout.bankAccountType ? `Account type: ${payout.bankAccountType}` : null,
      payout.bankName ? `Bank name: ${payout.bankName}` : null,
      payout.bankAddressLine1,
      payout.bankAddressLine2,
      [payout.bankCity, payout.bankState, payout.bankPostalCode].filter(Boolean).join(' '),
      payout.bankCountry
    ].filter(Boolean);

    let remarksY = remarksTop + 18;
    doc.font('Helvetica').fontSize(9).fillColor(theme.secondaryTextColor);
    for (const line of remarksLines) {
      doc.text(line, 48, remarksY, { width: 280 });
      remarksY += 12;
    }

    const totalsTop = remarksTop + 4;
    drawLabelValue(doc, 345, totalsTop, 'TOTAL HOURS', Number(invoice.totalHours || 0).toFixed(2), {
      labelWidth: 95,
      valueWidth: 90,
      labelColor: theme.mutedTextColor,
      valueColor: theme.textColor
    });
    drawLabelValue(doc, 345, totalsTop + 22, 'RATE / USD $', currency(invoice.rate), {
      labelWidth: 95,
      valueWidth: 90,
      labelColor: theme.mutedTextColor,
      valueColor: theme.textColor
    });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(theme.textColor);
    drawLabelValue(doc, 345, totalsTop + 44, 'TOTAL / USD $', currency(invoice.amount), {
      labelWidth: 95,
      valueWidth: 90,
      labelColor: theme.mutedTextColor,
      valueColor: theme.textColor
    });

    doc.end();

    stream.on('finish', () => {
      resolve({ fileName, filePath });
    });
    stream.on('error', reject);
  });
};

module.exports = { generateInvoicePdf, pdfFolder };
