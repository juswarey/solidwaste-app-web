// Resident feedback (port of feedback.php + feedback_view.php). Barangay Admin updates status; LGU views.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, LoadError, Loading, Messages, PageHead, ReadonlyBanner, useLoad } from '../components/common';
import { usePanel } from '../components/Layout';
import { loadOps, rangeFrom } from '../lib/ops';
import { supabase } from '../lib/supabase';
import { fmtStamp } from '../lib/time';
import { toast } from '../lib/ui';

function StatusForm({ row, statuses, onSaved }) {
  const [status, setStatus] = useState(row.status);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!statuses.includes(status)) { toast('Choose a valid status.', 'error'); return; }
    setBusy(true);
    const { error } = await supabase.from('feedback_report').update({ status }).eq('feedback_report_id', row.id);
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    onSaved(`Report #${row.id} marked as ${status}. The resident sees this in the app.`);
  };
  return (
    <form className="btn-row" style={{ flexWrap: 'nowrap' }} onSubmit={save}>
      <label className="sr-only" htmlFor={`st${row.id}`}>New status</label>
      <select className="select" id={`st${row.id}`} value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 130 }}>
        {statuses.map((s) => <option key={s}>{s}</option>)}
      </select>
      <button className="btn btn-ghost btn-sm" type="submit" disabled={busy}>Save</button>
    </form>
  );
}

export default function Feedback() {
  const { role, refreshBadges } = usePanel();
  const editable = role === 'barangay';
  const [params, setParams] = useSearchParams();
  const [success, setSuccess] = useState('');
  const { data: ops, error, loading, reload } = useLoad(() => loadOps({ feedback: true, fleet: false }), []);

  const status = params.get('status') ?? 'open';
  const type = params.get('type') ?? '';
  const zone = Number(params.get('zone') || 0);
  const rangeKey = ['7', '30', '90', 'month'].includes(params.get('range')) ? params.get('range') : '90';
  const setFilter = (k) => (e) => { const n = new URLSearchParams(params); n.set(k, e.target.value); setParams(n, { replace: true }); };

  let rows = [], sum = null, statuses = [], types = [], label = '';
  if (ops) {
    const [from, to, l] = rangeFrom(rangeKey, ops.clock.date);
    label = l;
    rows = ops.feedback({ from, to, status: status === 'all' ? '' : status, type, zone_id: zone });
    sum = ops.feedbackSummary(from, to);
    statuses = ops.feedbackStatuses();
    types = [...new Set((ops.d.feedback ?? []).map((r) => r.report_type).filter(Boolean))].sort();
  }

  return (
    <>
      <PageHead title="Resident feedback" desc={editable
        ? 'Concerns residents send from the mobile app. Update the status as you act on them; residents see it in the app.'
        : 'Every concern residents have sent from the mobile app, with how long unresolved ones have been open.'} />
      {!editable && <ReadonlyBanner>View only. The Barangay Admin updates report status.</ReadonlyBanner>}
      <Messages success={success} />
      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !ops && <Loading />}
      {ops && (
        <>
          <div className="status-strip mb">
            <div className="status-cell cell-delayed"><span className="lbl">Unresolved now</span><span className="num">{sum.open_all_time}</span><span className="sub">{sum.oldest_open_days !== null ? `Oldest ${sum.oldest_open_days} days` : 'All periods'}</span></div>
            <div className="status-cell cell-brand"><span className="lbl">Submitted</span><span className="num">{sum.total}</span><span className="sub">{label}</span></div>
            <div className="status-cell cell-done"><span className="lbl">Closed</span><span className="num">{sum.total - sum.open}</span><span className="sub">Resolved or dismissed, same period</span></div>
            <div className="status-cell cell-pending"><span className="lbl">Median age, open</span><span className="num">{sum.median_open_days !== null ? `${sum.median_open_days}d` : '–'}</span><span className="sub">Of reports from this period</span></div>
          </div>
          <section className="panel mb">
            <div className="filters panel-body">
              <div className="field"><label htmlFor="fStatus">Status</label><select className="select" id="fStatus" value={status} onChange={setFilter('status')}>
                <option value="open">Unresolved</option><option value="closed">Closed</option><option value="all">All</option>
                {statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="field"><label htmlFor="fType">Type</label><select className="select" id="fType" value={type} onChange={setFilter('type')}><option value="">All types</option>
                {types.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="field"><label htmlFor="fZone">Resident's zone</label><select className="select" id="fZone" value={zone} onChange={setFilter('zone')}><option value="0">All zones</option>
                {ops.zones().map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
              <div className="field"><label htmlFor="fRange">Submitted</label><select className="select" id="fRange" value={rangeKey} onChange={setFilter('range')}>
                {[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['month', 'This month']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>#</th><th>Report</th><th>Resident</th><th>Zone</th><th>Submitted</th><th>Status</th>{editable && <th>Update</th>}</tr></thead>
                <tbody>
                  {!rows.length && <tr><td colSpan={editable ? 7 : 6}><Empty icon="message" title="No reports match" text={status === 'open' ? 'There are no unresolved reports for these filters.' : 'Try a longer period or clear the filters.'} /></td></tr>}
                  {rows.map((r) => {
                    const css = r.open ? (r.status === 'In Progress' ? 'ongoing' : 'pending') : 'done';
                    return (
                      <tr key={r.id}>
                        <td className="muted">{r.id}</td>
                        <td><strong>{r.type}</strong>{r.description && <div style={{ maxWidth: '46ch' }}>{r.description}</div>}
                          {r.lat !== null ? <div className="muted">{r.lat.toFixed(5)}, {r.lng.toFixed(5)} · <Link to={`/${role}/map`}>On map</Link></div> : <div className="muted">No location shared</div>}</td>
                        <td>{r.resident}<div className="muted">{r.contact || r.email}</div></td>
                        <td>{r.zone}</td>
                        <td>{r.created_at ? fmtStamp(r.created_at, true) : '–'}{r.open && r.age_days !== null && <div className="muted">{r.age_days} day(s) open</div>}</td>
                        <td><span className={`chip ${css}`}>{r.status}</span></td>
                        {editable && <td><StatusForm key={r.status} row={r} statuses={statuses} onSaved={(m) => { setSuccess(m); reload(); refreshBadges(); }} /></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
