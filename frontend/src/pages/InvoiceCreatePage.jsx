import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceApi, profileApi, timelogApi } from '../services/api';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) {
    return '-';
  }

  const normalized = String(value).slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function getRangeFromPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'today') {
    const iso = toIsoDate(today);
    return { from: iso, to: iso };
  }

  if (preset === 'last2days') {
    return { from: toIsoDate(addDays(today, -1)), to: toIsoDate(today) };
  }

  if (preset === 'thisWeek') {
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = addDays(today, diffToMonday);
    return { from: toIsoDate(monday), to: toIsoDate(today) };
  }

  if (preset === 'lastWeek') {
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const thisMonday = addDays(today, diffToMonday);
    const lastMonday = addDays(thisMonday, -7);
    const lastSunday = addDays(thisMonday, -1);
    return { from: toIsoDate(lastMonday), to: toIsoDate(lastSunday) };
  }

  return { from: '', to: '' };
}

export default function InvoiceCreatePage({ user }) {
  const [timelogs, setTimelogs] = useState([]);
  const [message, setMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [rangePreset, setRangePreset] = useState('thisWeek');
  const [viewFrom, setViewFrom] = useState('');
  const [viewTo, setViewTo] = useState('');
  const [rateUsd, setRateUsd] = useState('');
  const [creatingGroupKey, setCreatingGroupKey] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState(null);

  const accountOptions = useMemo(() => {
    const map = new Map();
    timelogs.forEach((log) => {
      const key = `account:${log.accountKey || log.projectNumber || log.projectKey || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: `${log.accountKey || log.projectNumber || '-'}${log.accountName ? ` - ${log.accountName}` : ''}`
        });
      }
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [timelogs]);

  const filteredTimelogs = useMemo(() => {
    return timelogs.filter((log) => {
      const projectMatch =
        accountFilter === 'all' ||
        (accountFilter.startsWith('account:') &&
          String(log.accountKey || log.projectNumber || log.projectKey || '') === accountFilter.replace('account:', ''));

      const fromMatch = !viewFrom || String(log.workDate || '') >= viewFrom;
      const toMatch = !viewTo || String(log.workDate || '') <= viewTo;

      return projectMatch && fromMatch && toMatch;
    });
  }, [timelogs, accountFilter, viewFrom, viewTo]);

  const totalHours = useMemo(
    () => filteredTimelogs.reduce((sum, item) => sum + Number(item.hours || 0), 0).toFixed(2),
    [filteredTimelogs]
  );

  const groupedTimelogs = useMemo(() => {
      const groups = new Map();

      filteredTimelogs.forEach((log) => {
      const groupKey = `account:${log.accountKey || log.projectNumber || log.projectKey || 'unassigned'}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          accountId: log.accountId || null,
          accountKey: log.accountKey || log.projectNumber || log.projectKey || '-',
          accountName: log.accountName || log.projectName || 'Unknown Account',
          accountNumber: log.accountKey || log.projectNumber || '-',
          totalHours: 0,
          rows: []
        });
      }

      const group = groups.get(groupKey);
      group.rows.push(log);
      group.totalHours += Number(log.hours || 0);
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        totalHours: Number(group.totalHours.toFixed(2)),
        rows: group.rows.sort((a, b) => {
          const dateCompare = String(b.workDate || '').localeCompare(String(a.workDate || ''));
          if (dateCompare !== 0) {
            return dateCompare;
          }
          return Number(b.id || 0) - Number(a.id || 0);
        })
      }))
      .sort((a, b) => `${a.accountKey} ${a.accountName}`.localeCompare(`${b.accountKey} ${b.accountName}`));
  }, [filteredTimelogs]);

  const loadTimelogs = async () => {
    try {
      const rows = await timelogApi.list();
      setTimelogs(rows);
    } catch (error) {
      setTimelogs([]);
    }
  };

  useEffect(() => {
    loadTimelogs();
  }, []);

  useEffect(() => {
    profileApi
      .get()
      .then((response) => {
        const hourlyRate = response?.profile?.hourlyRateUsd;
        if (hourlyRate !== null && hourlyRate !== undefined && hourlyRate !== '') {
          setRateUsd(String(hourlyRate));
        }
      })
      .catch(() => {
        setRateUsd('');
      });
  }, []);

  useEffect(() => {
    if (rangePreset === 'custom') {
      return;
    }
    const range = getRangeFromPreset(rangePreset);
    setViewFrom(range.from);
    setViewTo(range.to);
  }, [rangePreset]);

  useEffect(() => {
    if (!isSyncing) {
      return undefined;
    }

    const timer = setInterval(async () => {
      try {
        const status = await timelogApi.getSyncStatus();
        setSyncStatus(status);

        if (!status.running) {
          setIsSyncing(false);
          const rows = await timelogApi.list();
          setTimelogs(rows);

          if (status.status === 'COMPLETED') {
            setMessage(
              `Timelog async sync completed. Mode: ${status.mode || '-'}, Synced: ${status.syncedCount}, Inserted: ${status.inserted}, Updated: ${status.updated}, Unchanged: ${status.unchanged}, Deleted marked: ${status.deletedMarked || 0}, Skipped(no tempo account ref): ${status.skippedNoProjectReference}, Linked accounts: ${status.linkedProjects}, Unlinked: ${status.unlinkedProjects}, Hours: ${status.totalHours}.`
            );
          } else {
            setMessage(
              `Timelog async sync failed${status.lastError ? ` | ${status.lastError}` : ''}${status.requestId ? ` | requestId: ${status.requestId}` : ''}`
            );
          }
        }
      } catch (error) {
        setIsSyncing(false);
        setMessage(error?.response?.data?.message || 'Failed to fetch timelog sync status');
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [isSyncing]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsSyncing(true);
    setMessage('Starting async timelog sync from Jira/Tempo...');

    try {
      const response = await timelogApi.sync();
      const status = await timelogApi.getSyncStatus();
      setSyncStatus(status);
      setMessage(
        `${response.message || 'Timelog sync started'}${response.requestId ? ` | requestId: ${response.requestId}` : ''}`
      );
    } catch (error) {
      const backendMessage = error?.response?.data?.message || 'Failed to sync timelogs';
      const backendError = error?.response?.data?.error;
      const requestId = error?.response?.data?.requestId;
      setMessage(
        `${backendMessage}${backendError ? ` | ${backendError}` : ''}${requestId ? ` | requestId: ${requestId}` : ''}`
      );
      setIsSyncing(false);
    } finally {
      // keep isSyncing=true while async job is running; it is cleared by polling when job completes/fails.
    }
  };

  const deleteTimelogs = async () => {
    const confirmed = window.confirm(
      'Delete all synced timelogs and reset the Tempo sync cursor? The next sync will start fresh from 1 Jan 2026.'
    );

    if (!confirmed) {
      return;
    }

    setMessage('Deleting all synced timelogs...');
    try {
      const result = await timelogApi.deleteAll();
      setTimelogs([]);
      setSyncStatus(null);
      setMessage(
        `${result.message || 'Timelogs deleted'}${result.deletedCount !== undefined ? ` | deleted: ${result.deletedCount}` : ''}`
      );
    } catch (error) {
      const backendMessage = error?.response?.data?.message || 'Failed to delete timelogs';
      const requestId = error?.response?.data?.requestId;
      const linkedCount = error?.response?.data?.linkedInvoiceItemCount;
      setMessage(
        `${backendMessage}${linkedCount ? ` | linked invoice items: ${linkedCount}` : ''}${requestId ? ` | requestId: ${requestId}` : ''}`
      );
    }
  };

  const createInvoiceForGroup = async (group) => {
    const resolvedRate = Number(rateUsd);
    if (!Number.isFinite(resolvedRate) || resolvedRate <= 0) {
      setMessage('Set a valid hourly rate before creating an invoice.');
      return;
    }

    const groupDates = group.rows
      .map((row) => String(row.workDate || ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const startDate = viewFrom || groupDates[0];
    const endDate = viewTo || groupDates[groupDates.length - 1];

    if (!startDate || !endDate) {
      setMessage('Could not determine invoice date range from selected account timelogs.');
      return;
    }

    setCreatingGroupKey(group.key);
    setMessage(`Creating invoice for ${group.accountKey || group.accountName}...`);

    try {
      const invoice = await invoiceApi.syncCreate({
        accountKey: group.accountKey,
        startDate,
        endDate,
        rate: resolvedRate,
        timesheetEntryIds: group.rows.map((row) => row.id)
      });

      setMessage('');
      setCreatedInvoice(invoice);
    } catch (error) {
      const backendMessage = error?.response?.data?.message || 'Failed to create invoice';
      const invoiceNumber = error?.response?.data?.invoiceNumber;
      setMessage(`${backendMessage}${invoiceNumber ? ` | ${invoiceNumber}` : ''}`);
    } finally {
      setCreatingGroupKey('');
    }
  };

  return (
    <div className="space-y-6">
      <form className="grid gap-4" onSubmit={onSubmit}>
        <h2 className="text-xl font-semibold text-white">Step 1: Sync Timelogs</h2>
        <p className="text-sm text-slate-400">
          First sync runs from 1 Jan 2026 to now. After that, Tempo `updatedFrom` watermarking is used automatically.
        </p>
        {user?.isSuperAdmin && !user?.jiraConnected ? (
          <p className="text-sm text-amber-200">
            Connect Jira to run timelog sync. Other invoice actions remain available.
          </p>
        ) : null}

        {user?.isSuperAdmin ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="w-fit rounded-lg bg-[#3C50E0] px-4 py-2 font-semibold text-white hover:bg-[#3043cc] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!user?.jiraConnected || isSyncing}
            >
              {isSyncing ? 'Sync In Progress...' : 'Sync Timelogs (Async)'}
            </button>
            <button
              type="button"
              onClick={deleteTimelogs}
              disabled={isSyncing}
              className="w-fit rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-semibold text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete All Timelogs
            </button>
          </div>
        ) : null}
        <p className="text-sm text-slate-300">{message}</p>
        {syncStatus && (
          <p className="text-xs text-slate-400">
            Job status: {syncStatus.status || 'UNKNOWN'} | Mode: {syncStatus.mode || '-'} | Synced:{' '}
            {syncStatus.syncedCount || 0} | Inserted: {syncStatus.inserted || 0} | Updated: {syncStatus.updated || 0}
            {' '}| Deleted: {syncStatus.deletedMarked || 0} | Skipped(no account): {syncStatus.skippedNoProjectReference || 0}
          </p>
        )}
      </form>

      <div className="rounded-xl border border-[#2D3748] bg-[#1A2233] p-4">
        <h3 className="text-base font-semibold text-white">Synced Timelogs</h3>
        <p className="mt-1 text-sm text-slate-400">
          Accounts: {groupedTimelogs.length} | Rows: {filteredTimelogs.length} / {timelogs.length} | Total Hours:{' '}
          {totalHours}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[#2D3748] bg-[#111928] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Hourly Rate (USD)</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {rateUsd && Number(rateUsd) > 0 ? `$${Number(rateUsd).toFixed(2)}` : 'Not set in profile'}
            </p>
          </div>
          <div className="md:col-span-3 flex items-center text-xs text-slate-400">
            One invoice is created per Tempo account using the currently visible date range. Update the hourly rate from your profile page.
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="rounded-lg border border-[#2D3748] bg-[#111928] px-3 py-2 text-sm text-white"
          >
            <option value="all">All Accounts</option>
            {accountOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={rangePreset}
            onChange={(event) => setRangePreset(event.target.value)}
            className="rounded-lg border border-[#2D3748] bg-[#111928] px-3 py-2 text-sm text-white"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="last2days">Last 2 Days</option>
            <option value="thisWeek">This Week</option>
            <option value="lastWeek">Last Week</option>
            <option value="custom">Custom Range</option>
          </select>

          <input
            type="date"
            value={viewFrom}
            onChange={(event) => {
              setRangePreset('custom');
              setViewFrom(event.target.value);
            }}
            className="rounded-lg border border-[#2D3748] bg-[#111928] px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={viewTo}
            onChange={(event) => {
              setRangePreset('custom');
              setViewTo(event.target.value);
            }}
            className="rounded-lg border border-[#2D3748] bg-[#111928] px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="mt-4 space-y-4">
          {groupedTimelogs.map((group) => (
            <div key={group.key} className="overflow-x-auto rounded-lg border border-[#3B82F6]/50 bg-[#0B1220] shadow-[0_0_0_1px_rgba(59,130,246,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3B82F6]/40 bg-[#0F1B33] px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-[#E2E8F0]">
                    {group.accountKey} {group.accountName ? `- ${group.accountName}` : ''}
                  </p>
                  <p className="text-xs text-[#93C5FD]">
                    Account Number: {group.accountNumber} | Logs: {group.rows.length}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-[#34D399]">Account Hours: {group.totalHours}</p>
                  <button
                    type="button"
                    onClick={() => createInvoiceForGroup(group)}
                    disabled={creatingGroupKey === group.key}
                    className="rounded-lg bg-[#F59E0B] px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-[#FBBF24] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingGroupKey === group.key ? 'Creating...' : 'Create Invoice'}
                  </button>
                </div>
              </div>

              <table className="min-w-full text-sm">
                <thead className="bg-[#101B2E] text-left text-[#CBD5E1]">
                  <tr>
                    <th className="w-36 whitespace-nowrap px-4 py-3">Date</th>
                    <th className="w-40 whitespace-nowrap px-4 py-3">Issue</th>
                    <th className="w-24 whitespace-nowrap px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((log) => (
                    <tr key={log.id} className="border-t border-[#334155] text-[#E2E8F0]">
                      <td className="whitespace-nowrap px-4 py-3">{formatDisplayDate(log.workDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{log.issueKey || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3">{log.hours}</td>
                      <td className="px-4 py-3">{log.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {groupedTimelogs.length === 0 && (
            <div className="rounded-lg border border-[#2D3748] bg-[#111928] px-4 py-4 text-sm text-slate-400">
              No timelogs found for selected filters.
            </div>
          )}
        </div>
      </div>

      {createdInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#2D3748] bg-[#111928]">
            <div className="bg-emerald-600 px-5 py-3">
              <h3 className="text-lg font-semibold text-white">Invoice Generated</h3>
            </div>
            <div className="p-5">
              <table className="w-full overflow-hidden rounded-lg border border-[#2D3748] text-sm">
                <tbody className="divide-y divide-[#2D3748]">
                  <tr>
                    <th className="w-2/5 bg-[#1A2233] px-3 py-2 text-left font-medium text-slate-400">Invoice</th>
                    <td className="px-3 py-2 font-medium text-white">{createdInvoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <th className="w-2/5 bg-[#1A2233] px-3 py-2 text-left font-medium text-slate-400">Project</th>
                    <td className="px-3 py-2 font-medium text-white">{createdInvoice.projectName || '-'}</td>
                  </tr>
                  <tr>
                    <th className="w-2/5 bg-[#1A2233] px-3 py-2 text-left font-medium text-slate-400">Total Hours</th>
                    <td className="px-3 py-2 font-medium text-white">{createdInvoice.totalHours}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreatedInvoice(null)}
                  className="rounded-lg border border-[#2D3748] bg-[#1A2233] px-3 py-2 text-sm text-white hover:bg-[#243041]"
                >
                  Close
                </button>
                <Link
                  to={`/invoices/${createdInvoice.id}`}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  View Invoice
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
