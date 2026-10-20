// Emergency collections (port of emergency.php + emergency_view.php).
// Barangay Admin arranges and tracks one-time pickups; the LGU Admin views.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import Icon from '../components/Icon';
import { Empty, LoadError, Loading, Messages, PageHead, ReadonlyBanner, useLoad } from '../components/common';
import { usePanel } from '../components/Layout';
import { EMERGENCY_STATUSES, loadOps } from '../lib/ops';
import { supabase } from '../lib/supabase';
import { addDays, fmtDate, fmtStamp } from '../lib/time';
import { color, esc, toast } from '../lib/ui';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../config';

const statusCss = (status, overdue) => (overdue ? 'delayed' : ({ Scheduled: 'pending', 'In progress': 'ongoing', Completed: 'done', Cancelled: '' }[status] ?? ''));

/** Click-to-place map, limited to Barangay Poblacion. */
function PickMap({ lat, lng, onPick, zones }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  useEffect(() => {
    const m = L.map(box.current, { scrollWheelZoom: false, zoomSnap: 0.25 }).setView([8.2290, 124.2365], 16);
    map.current = m;
    let alive = true;   // the boundary loads in the background; ignore it if the map was removed meanwhile
    L.tileLayer(MAP_TILE_URL, { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: MAP_TILE_ATTRIBUTION }).addTo(m);
    m.createPane('outside'); m.getPane('outside').style.zIndex = 350; m.getPane('outside').style.pointerEvents = 'none';
    fetch('/data/poblacion_boundary.geojson').then((r) => r.json()).then((g) => {
      if (!alive) return;
      const pob = g.features.find((f) => f.properties.kind === 'barangay_boundary');
      const ext = g.features.find((f) => f.properties.kind === 'display_extent') || pob;
      L.geoJSON(pob, { style: { color: '#14231d', weight: 2, fill: false, interactive: false } }).addTo(m);
      const ring = ext.geometry.coordinates[0].map((c) => [c[1], c[0]]);
      L.polygon([[[-90, -360], [-90, 360], [90, 360], [90, -360]], ring], { pane: 'outside', stroke: false, fillColor: color('bg') || '#f3f5f2', fillOpacity: 1, interactive: false }).addTo(m);
      const bb = L.latLngBounds(ring);
      m.setMaxBounds(bb.pad(0.35));
      if (!marker.current) m.fitBounds(bb, { padding: [10, 10], animate: false });
    }).catch(() => {});
    for (const z of zones) {
      if (z.boundary.length > 2) {
        L.polygon(z.boundary, { color: z.color, weight: 1.5, fillOpacity: 0.12, dashArray: '5 4', interactive: false })
          .bindTooltip(esc(z.name), { permanent: true, direction: 'center', className: 'zone-label' }).addTo(m);
      }
    }
    m.on('click', (e) => onPick(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)));
    const ro = new ResizeObserver(() => m.invalidateSize()); ro.observe(box.current);
    return () => { alive = false; ro.disconnect(); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const a = Number(lat), b = Number(lng);
    if (lat !== '' && lng !== '' && Number.isFinite(a) && Number.isFinite(b)) {
      if (marker.current) marker.current.setLatLng([a, b]);
      else { marker.current = L.marker([a, b], { icon: L.divIcon({ className: '', html: '<div class="em-pin">!</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(m); m.setView([a, b], 17); }
    } else if (marker.current) { marker.current.remove(); marker.current = null; }
  }, [lat, lng]);
  return <div ref={box} style={{ height: 300, border: '1px solid var(--line)', borderRadius: 'var(--radius)', marginTop: 14 }} aria-label="Click to set the pickup location" />;
}

function EmergencyForm({ ops, editing, me, onDone, onCancel }) {
  const crew = ops.crew().collector_id;
  const [f, setF] = useState(() => ({
    collection_date: editing?.date ?? ops.clock.date, start_time: (editing?.start ?? '').slice(0, 5), end_time: (editing?.end ?? '').slice(0, 5),
    route_id: editing?.zone_id ?? '', location_text: editing?.location ?? '', reason: editing?.reason ?? '',
    garbage_collector_id: editing ? (editing.collector_id ?? '') : (crew ?? ''), latitude: editing?.lat ?? '', longitude: editing?.lng ?? '', notes: editing?.notes ?? '',
  }));
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const collectors = [...ops.fleet()].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

  const save = async (e) => {
    e.preventDefault();
    const lat = String(f.latitude).trim(), lng = String(f.longitude).trim();
    if ((lat !== '' || lng !== '') && (lat === '' || lng === '' || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng)))) {
      setErrors(['Map location must be latitude and longitude in Iligan City, or left blank.']); return;
    }
    const row = {
      collection_date: f.collection_date || null, start_time: f.start_time || null, end_time: f.end_time || null,
      route_id: f.route_id === '' ? null : Number(f.route_id), location_text: f.location_text, reason: f.reason,
      garbage_collector_id: f.garbage_collector_id === '' ? null : Number(f.garbage_collector_id),
      latitude: lat === '' ? null : Number(lat), longitude: lng === '' ? null : Number(lng), notes: f.notes,
    };
    setBusy(true);
    const res = editing
      ? await supabase.from('emergency_collection').update(row).eq('emergency_collection_id', editing.id)
      : await supabase.from('emergency_collection').insert({ ...row, created_by: me.id });
    setBusy(false);
    if (res.error) { setErrors(res.error.message.split('\n')); return; }
    onDone(editing ? 'Emergency collection updated.' : `Emergency collection scheduled for ${fmtDate(f.collection_date, 'l, M j')}. It now shows on the dashboard, map and schedule.`);
  };

  return (
    <section className="panel mb" aria-labelledby="emTitle">
      <div className="panel-head"><h2 id="emTitle">{editing ? `Edit emergency collection #${editing.id}` : 'Schedule an emergency collection'}</h2>
        <button type="button" className="panel-link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={onCancel}>Cancel</button>
        <p>The barangay has one truck. Check the fixed schedule for that day so the pickup does not clash with a regular stop.</p></div>
      <form className="panel-body" onSubmit={save}>
        <Messages errors={errors} />
        <div className="form-grid">
          <div className="field"><label htmlFor="collection_date">Date</label><input className="input" type="date" id="collection_date" min={editing ? undefined : ops.clock.date} value={f.collection_date} onChange={set('collection_date')} required /></div>
          <div className="field"><label htmlFor="start_time">Truck arrives</label><input className="input" type="time" id="start_time" value={f.start_time} onChange={set('start_time')} required /></div>
          <div className="field"><label htmlFor="end_time">Until (optional)</label><input className="input" type="time" id="end_time" value={f.end_time} onChange={set('end_time')} /></div>
          <div className="field"><label htmlFor="route_id">Zone</label>
            <select className="select" id="route_id" value={f.route_id} onChange={set('route_id')}><option value="">Choose a zone…</option>{ops.zones().map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
          <div className="field wide"><label htmlFor="location_text">Where exactly</label><input className="input" id="location_text" maxLength={255} placeholder="e.g. corner of Zamora St. and Benito Labao St." value={f.location_text} onChange={set('location_text')} required /></div>
          <div className="field wide"><label htmlFor="reason">Reason</label><input className="input" id="reason" maxLength={255} placeholder="e.g. flood debris after heavy rain" value={f.reason} onChange={set('reason')} required /></div>
          <div className="field"><label htmlFor="garbage_collector_id">Collector</label>
            <select className="select" id="garbage_collector_id" value={f.garbage_collector_id} onChange={set('garbage_collector_id')}><option value="">Not assigned yet</option>
              {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}{c.truck ? ` (${c.truck})` : ''}</option>)}</select>
            <span className="hint">Their truck is recorded with the pickup.</span></div>
          <div className="field"><label htmlFor="latitude">Map location (optional)</label>
            <div style={{ display: 'flex', gap: 6 }}><input className="input" id="latitude" placeholder="Latitude" inputMode="decimal" value={f.latitude} onChange={set('latitude')} /><input className="input" id="longitude" placeholder="Longitude" inputMode="decimal" value={f.longitude} onChange={set('longitude')} /></div>
            <span className="hint">Click the map below to fill these in.</span></div>
          <div className="field wide"><label htmlFor="notes">Notes (optional)</label><textarea className="textarea" id="notes" rows={2} value={f.notes} onChange={set('notes')} /></div>
        </div>
        <PickMap lat={f.latitude} lng={f.longitude} zones={ops.zones()} onPick={(a, b) => setF((s) => ({ ...s, latitude: a, longitude: b }))} />
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" type="submit" disabled={busy}><Icon name="check" />{editing ? 'Save changes' : 'Schedule collection'}</button>
          <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

function StatusCell({ row, onSaved }) {
  const [status, setStatus] = useState(row.status);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!EMERGENCY_STATUSES.includes(status)) return;
    setBusy(true);
    const { error } = await supabase.from('emergency_collection').update({ status }).eq('emergency_collection_id', row.id);
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    onSaved(`Emergency collection #${row.id} marked ${status}.`);
  };
  return (
    <form onSubmit={save} className="btn-row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
      <label className="sr-only" htmlFor={`es${row.id}`}>Status</label>
      <select className="select" id={`es${row.id}`} value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 120 }}>
        {EMERGENCY_STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <button className="btn btn-ghost btn-sm" type="submit" disabled={busy}>Save</button>
    </form>
  );
}

export default function Emergency() {
  const { role, me, refreshBadges } = usePanel();
  const editable = role === 'barangay';
  const [params, setParams] = useSearchParams();
  const view = ['open', 'upcoming', 'past', 'all'].includes(params.get('view')) ? params.get('view') : 'open';
  const editId = Number(params.get('edit') || 0);
  const showNew = editable && params.get('new') === '1';
  const [success, setSuccess] = useState('');
  const { data: ops, error, loading, reload } = useLoad(() => loadOps({ emergency: true }), []);

  const go = (patch) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); } setParams(n, { replace: true }); };
  const done = (msg) => { setSuccess(msg); go({ new: null, edit: null }); reload(); refreshBadges(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  let rows = [], sum = null, editing = null;
  if (ops) {
    const f = { order: 'asc' };
    if (view === 'open') f.status = 'open';
    if (view === 'upcoming') f.from = ops.clock.date;
    if (view === 'past') { f.to = addDays(ops.clock.date, -1); f.order = 'desc'; }
    if (view === 'all') { f.order = 'desc'; f.limit = 300; }
    rows = ops.emList(f);
    sum = ops.emSummary(addDays(ops.clock.date, -29), addDays(ops.clock.date, 60));
    if (editable && editId) editing = ops.emList({ id: editId })[0] ?? null;
  }
  const showForm = editable && ops && (editing || showNew);

  return (
    <>
      <PageHead title="Emergency collections" desc={editable
        ? 'One-time pickups when garbage cannot wait for the fixed schedule, for example after a flood, a fiesta or an overflowing site.'
        : 'One-time pickups the barangay arranged outside the fixed schedule.'}>
        {editable && !showForm && <button type="button" className="btn btn-primary" onClick={() => { setSuccess(''); go({ new: '1', edit: null }); }}><Icon name="plus" />Schedule emergency collection</button>}
      </PageHead>
      {!editable && <ReadonlyBanner>View only. Barangay Poblacion is responsible for emergency collections.</ReadonlyBanner>}
      <Messages success={success} />
      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !ops && <Loading />}
      {showForm && <EmergencyForm key={editing?.id ?? 'new'} ops={ops} editing={editing} me={me} onDone={done} onCancel={() => go({ new: null, edit: null })} />}
      {ops && (
        <>
          <div className="status-strip mb">
            <div className="status-cell cell-pending"><span className="lbl">Scheduled</span><span className="num">{sum.Scheduled}</span><span className="sub">Last 30 days and upcoming</span></div>
            <div className="status-cell cell-ongoing"><span className="lbl">In progress</span><span className="num">{sum['In progress']}</span><span className="sub">Truck on the way or collecting</span></div>
            <div className="status-cell cell-done"><span className="lbl">Completed</span><span className="num">{sum.Completed}</span><span className="sub">Last 30 days</span></div>
            <div className="status-cell cell-delayed"><span className="lbl">Overdue</span><span className="num">{sum.overdue}</span><span className="sub">Time passed, not marked done</span></div>
          </div>
          <section className="panel mb">
            <div className="panel-head"><h2>Emergency collections</h2>
              <div className="seg" role="group" aria-label="Show">
                {[['open', 'Not done yet'], ['upcoming', 'Today onward'], ['past', 'Past'], ['all', 'All']].map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={view === k} onClick={() => go({ view: k })}>{l}</button>
                ))}
              </div>
              <p>One-time pickups outside the fixed schedule. They are reported separately and do not change the fixed-schedule completion rate.</p>
            </div>
            <div className="table-wrap" style={{ marginTop: 10 }}><table className="tbl">
              <thead><tr><th>Date</th><th>Where</th><th>Reason</th><th>Collector · truck</th><th>Status</th>{editable ? <th>Update</th> : <th>Arranged by</th>}</tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={6}><Empty icon="alert" title="No emergency collections" text={editable ? 'Use "Schedule emergency collection" when garbage needs picking up outside the fixed schedule.' : 'The Barangay Admin has not arranged any for this view.'} /></td></tr>}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{fmtDate(r.date, 'D, M j')}</strong><div className="muted">{r.window}</div></td>
                    <td>{r.location}<div className="muted"><span style={{ color: r.color }}>●</span> {r.zone}{r.lat !== null ? ' · on map' : ''}</div></td>
                    <td style={{ maxWidth: '32ch' }}>{r.reason}{r.notes && <div className="muted">{r.notes.length > 120 ? `${r.notes.slice(0, 119)}…` : r.notes}</div>}</td>
                    <td>{r.collector}<div className="muted">{r.truck ?? 'No truck'}</div></td>
                    <td><span className={`chip ${statusCss(r.status, r.overdue)}`}>{r.status}{r.overdue ? ' · overdue' : ''}</span>
                      {r.completed_at && <div className="muted">Done {fmtStamp(r.completed_at)}</div>}</td>
                    {editable
                      ? <td className="actions"><div className="btn-row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          <StatusCell row={r} onSaved={done} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSuccess(''); go({ edit: r.id, new: null }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="edit" />Edit</button>
                        </div></td>
                      : <td>{r.created_by}<div className="muted">{fmtStamp(r.created_at)}</div></td>}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        </>
      )}
    </>
  );
}
