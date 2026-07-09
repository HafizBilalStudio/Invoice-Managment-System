import { useEffect, useMemo, useState } from 'react';
import { syncLogsApi } from '../services/api';

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default function UnmatchedProjectLinksPage({ user }) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sourceLog, setSourceLog] = useState(null);
  const [unmatchedProjects, setUnmatchedProjects] = useState([]);

  const loadData = async (term = '') => {
    setLoading(true);
    try {
      const response = await syncLogsApi.unmatchedProjectLinks({ search: term });
      setSourceLog(response.sourceLog || null);
      setUnmatchedProjects(response.unmatchedProjects || []);
      setMessage('');
    } catch (error) {
      setSourceLog(null);
      setUnmatchedProjects([]);
      setMessage(error?.response?.data?.message || 'Failed to load unmatched project links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData(search);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const counts = useMemo(() => {
    return unmatchedProjects.reduce(
      (acc, item) => {
        const reason = item.reason || 'Unknown';
        acc.total += 1;
        acc.byReason.set(reason, (acc.byReason.get(reason) || 0) + 1);
        return acc;
      },
      { total: 0, byReason: new Map() }
    );
  }, [unmatchedProjects]);

  if (!user?.isSuperAdmin) {
    return <p className="text-sm text-amber-200">Only the configured super admin can view unmatched project links.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Unmatched Project Links</h2>
          <p className="text-sm text-slate-400">
            Projects skipped during the latest Tempo-to-Jira project account linking run.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadData(search)}
          disabled={loading}
          className="rounded-lg bg-[#3C50E0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3043cc] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {sourceLog ? (
        <div className="rounded-lg border border-[#2D3748] bg-[#0F172A] p-4 text-sm text-slate-300">
          <div className="grid gap-2 md:grid-cols-4">
            <div><span className="text-slate-400">Log Request:</span> {sourceLog.requestId}</div>
            <div><span className="text-slate-400">Started:</span> {formatDateTime(sourceLog.startedAt)}</div>
            <div><span className="text-slate-400">Finished:</span> {formatDateTime(sourceLog.finishedAt)}</div>
            <div><span className="text-slate-400">Skipped:</span> {sourceLog.summary?.skippedNoTempoMatch ?? 0}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[#2D3748] bg-[#0F172A] p-4 text-sm text-slate-400">
          No completed project-account linking log found yet.
        </div>
      )}

      <p className="text-sm text-slate-300">{message}</p>

      <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by project key, account number, project number, reason"
          className="rounded-md border border-[#2D3748] bg-[#0F172A] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#3C50E0] focus:outline-none"
        />
        <div className="rounded-md border border-[#2D3748] bg-[#0F172A] px-3 py-2 text-sm text-slate-300">
          Total unmatched: <span className="font-semibold text-white">{counts.total}</span>
        </div>
      </div>

      {counts.byReason.size > 0 ? (
        <div className="rounded-lg border border-[#2D3748] bg-[#0F172A] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Reason Summary</p>
          <div className="flex flex-wrap gap-2">
            {[...counts.byReason.entries()].map(([reason, count]) => (
              <span
                key={reason}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
              >
                {count} x {reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-[#2D3748]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#111928] text-left text-slate-300">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Current Account</th>
              <th className="px-4 py-3">Tried Account</th>
              <th className="px-4 py-3">Tried Project No.</th>
              <th className="px-4 py-3">Latest Timelog</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {unmatchedProjects.map((item, index) => (
              <tr key={`${item.projectId}-${index}`} className="border-t border-[#2D3748] align-top text-slate-200">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{item.projectKey || '-'}</div>
                  <div className="text-xs text-slate-400">Project ID: {item.projectId || '-'}</div>
                </td>
                <td className="px-4 py-3">{item.existingProjectAccountNumber || '-'}</td>
                <td className="px-4 py-3">{item.attemptedProjectAccountNumber || '-'}</td>
                <td className="px-4 py-3">{item.attemptedProjectNumber || '-'}</td>
                <td className="px-4 py-3">
                  <div>{item.latestWorkDate || '-'}</div>
                  <div className="text-xs text-slate-400">Entry ID: {item.latestTimesheetEntryId || '-'}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{item.reason || '-'}</td>
              </tr>
            ))}
            {unmatchedProjects.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={6}>
                  No unmatched project links found for the latest run.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
