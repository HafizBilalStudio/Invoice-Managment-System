import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceApi } from '../services/api';

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [submitTargetInvoiceId, setSubmitTargetInvoiceId] = useState(null);
  const [selectedApproverId, setSelectedApproverId] = useState('');

  const loadInvoices = async () => {
    try {
      const rows = await invoiceApi.list({ mine: true });
      setInvoices(rows);
      setMessage('');
    } catch (error) {
      setInvoices([]);
      setMessage(error?.response?.data?.message || 'Failed to load invoices');
    }
  };

  useEffect(() => {
    loadInvoices();
    invoiceApi
      .listApprovers()
      .then((rows) => setApprovers(rows))
      .catch(() => setApprovers([]));
  }, []);

  const accountOptions = useMemo(() => {
    const map = new Map();
    invoices.forEach((invoice) => {
      const key = invoice.projectKey || invoice.projectName || 'Unknown';
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: `${invoice.projectKey || '-'}${invoice.projectName ? ` - ${invoice.projectName}` : ''}`
        });
      }
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const statusMatch = statusFilter === 'all' || invoice.statusCode === statusFilter;
      const projectValue = invoice.projectKey || invoice.projectName || 'Unknown';
      const projectMatch = accountFilter === 'all' || projectValue === accountFilter;
      const fromMatch = !dateFrom || String(invoice.startDate || '') >= dateFrom;
      const toMatch = !dateTo || String(invoice.endDate || '') <= dateTo;
      return statusMatch && projectMatch && fromMatch && toMatch;
    });
  }, [invoices, statusFilter, accountFilter, dateFrom, dateTo]);

  const regeneratePdf = async (invoiceId) => {
    setRegeneratingId(invoiceId);
    setMessage('Regenerating invoice PDF...');
    try {
      await invoiceApi.regeneratePdf(invoiceId);
      await loadInvoices();
      setMessage('Invoice PDF regenerated.');
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to regenerate invoice PDF');
    } finally {
      setRegeneratingId(null);
    }
  };

  const submitInvoice = async (invoiceId, pmApproverUserId) => {
    setSubmittingId(invoiceId);
    setMessage('Submitting invoice for approval...');
    try {
      await invoiceApi.submit(invoiceId, { pmApproverUserId });
      await loadInvoices();
      setMessage('Invoice submitted for approval.');
      setSubmitTargetInvoiceId(null);
      setSelectedApproverId('');
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to submit invoice for approval');
    } finally {
      setSubmittingId(null);
    }
  };

  const deleteInvoice = async (invoiceId, invoiceNumber) => {
    const confirmed = window.confirm(
      `Delete draft invoice ${invoiceNumber}? This will permanently remove the invoice and its line items.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(invoiceId);
    setMessage('Deleting invoice...');
    try {
      await invoiceApi.delete(invoiceId);
      await loadInvoices();
      setMessage('Invoice deleted successfully.');
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to delete invoice');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelInvoice = async (invoiceId, invoiceNumber) => {
    const confirmed = window.confirm(
      `Cancel submitted invoice ${invoiceNumber}? It will remain in history, exit approval flow, and its timelogs can be reused for a new invoice.`
    );
    if (!confirmed) {
      return;
    }

    setCancellingId(invoiceId);
    setMessage('Cancelling invoice...');
    try {
      await invoiceApi.cancel(invoiceId);
      await loadInvoices();
      setMessage('Invoice cancelled successfully.');
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">My Invoices</h2>
        <p className="mt-1 text-sm text-slate-400">
          View the invoices you created by Tempo account, filter them, and open or download the generated PDF.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white"
        >
          <option value="all">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_PM">Pending Approval</option>
          <option value="APPROVED_PM">Approved</option>
          <option value="REJECTED_PM">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="PAID">Paid</option>
        </select>

        <select
          value={accountFilter}
          onChange={(event) => setAccountFilter(event.target.value)}
          className="rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white"
        >
          <option value="all">All Accounts</option>
          {accountOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white"
        />
      </div>

      <p className="text-sm text-slate-300">{message}</p>

      <div className="overflow-hidden rounded-xl border border-[#2D3748] bg-[#1A2233]">
        <div className="border-b border-[#2D3748] px-4 py-3 text-sm text-slate-300">
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#111928] text-left text-slate-300">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned PM</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => {
                const pdfUrl = invoiceApi.pdfUrl(invoice.pdfPath);
                const canCancelInvoice =
                  !['DRAFT', 'PAID', 'CANCELLED'].includes(String(invoice.statusCode || '').toUpperCase());
                return (
                  <tr key={invoice.id} className="border-t border-[#2D3748] text-slate-200">
                    <td className="px-4 py-3 font-semibold text-white">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div>{invoice.projectName || '-'}</div>
                      <div className="text-xs text-slate-400">
                        {invoice.projectKey || '-'}
                        {invoice.projectAccountNumber ? ` | ${invoice.projectAccountNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(invoice.startDate)} - {formatDate(invoice.endDate)}
                    </td>
                    <td className="px-4 py-3">{invoice.totalHours}</td>
                    <td className="px-4 py-3">${invoice.amount}</td>
                    <td className="px-4 py-3">{invoice.status}</td>
                    <td className="px-4 py-3">{invoice.pmApproverName || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-[#3C50E0]/40 bg-[#3C50E0]/10 px-3 py-1.5 text-xs font-semibold text-[#AFC2FF] hover:bg-[#3C50E0]/20"
                        >
                          View PDF
                        </a>
                        <Link
                          to={`/invoices/${invoice.id}`}
                          state={{ from: '/invoices', backLabel: 'Back to My Invoices' }}
                          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                        >
                          View
                        </Link>
                        <a
                          href={pdfUrl}
                          download
                          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          onClick={() => regeneratePdf(invoice.id)}
                          disabled={regeneratingId === invoice.id}
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {regeneratingId === invoice.id ? 'Generating...' : 'Generate PDF'}
                        </button>
                        {invoice.statusCode === 'DRAFT' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSubmitTargetInvoiceId(invoice.id);
                                setSelectedApproverId('');
                              }}
                              disabled={submittingId === invoice.id}
                              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {submittingId === invoice.id ? 'Submitting...' : 'Submit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteInvoice(invoice.id, invoice.invoiceNumber)}
                              disabled={deletingId === invoice.id}
                              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId === invoice.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        ) : null}
                        {canCancelInvoice ? (
                          <button
                            type="button"
                            onClick={() => cancelInvoice(invoice.id, invoice.invoiceNumber)}
                            disabled={cancellingId === invoice.id}
                            className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-200 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingId === invoice.id ? 'Cancelling...' : 'Cancel Invoice'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {submitTargetInvoiceId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#2D3748] bg-[#111928] p-5">
            <h3 className="text-lg font-semibold text-white">Submit Invoice</h3>
            <p className="mt-1 text-sm text-slate-400">Select a project manager to receive this invoice.</p>
            <select
              value={selectedApproverId}
              onChange={(event) => setSelectedApproverId(event.target.value)}
              className="mt-4 w-full rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white"
            >
              <option value="">Select Project Manager</option>
              {approvers.map((approver) => (
                <option key={approver.id} value={approver.id}>
                  {approver.name} ({approver.email})
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitTargetInvoiceId(null);
                  setSelectedApproverId('');
                }}
                className="rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white hover:bg-[#243041]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitInvoice(submitTargetInvoiceId, Number(selectedApproverId))}
                disabled={!selectedApproverId || submittingId === submitTargetInvoiceId}
                className="rounded-lg bg-[#3C50E0] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3043cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingId === submitTargetInvoiceId ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
