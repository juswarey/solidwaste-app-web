// Trucks (port of lgu_admin/trucks.php). LGU Admin manages the fleet; Barangay Admins assign trucks to collectors.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Empty, LoadError, Loading, Messages, PageHead, useLoad } from '../components/common';
import { loadOps } from '../lib/ops';
import { supabase, explain } from '../lib/supabase';
import { confirmDialog } from '../lib/ui';

const STATE_CHIP = { live: ['ongoing', 'Live GPS'], scheduled: ['done', 'Scheduled today'], idle: ['', 'Idle today'], unassigned: ['plain', 'No crew'] };

export default function Trucks() {
  const [params, setParams] = useSearchParams();
  const editId = Number(params.get('edit') || 0);
  const { data: ops, error, loading, reload } = useLoad(() => loadOps({ logsToday: true }), []);
  const trucks = ops?.trucks() ?? [];
  const editing = editId ? ops?.d.trucks.find((t) => t.truck_id === editId) ?? null : null;
  const key = editing ? editing.truck_id : 'new';
  const [form, setForm] = useState({ key: null, plate: '', cap: '' });
  const [msg, setMsg] = useState({ success: '', errors: [] });
  if (ops && form.key !== key) setForm({ key, plate: editing?.plate_number ?? '', cap: editing?.max_capacity_kg ?? '' });
  const setEdit = (id) => { const n = new URLSearchParams(params); if (id) n.set('edit', id); else n.delete('edit'); setParams(n, { replace: true }); };

  const save = async (e) => {
    e.preventDefault();
    const plate = form.plate.trim().toUpperCase();
    const cap = Number(form.cap);
    const errs = [];
    if (!plate || plate.length > 20) errs.push('Enter the plate number (up to 20 characters).');
    if (!(cap > 0 && cap <= 100000)) errs.push('Enter the maximum load in kilograms (a positive number).');
    if (ops.d.trucks.some((t) => String(t.plate_number).toUpperCase() === plate && t.truck_id !== editing?.truck_id)) errs.push('A truck with that plate number already exists.');
    if (errs.length) { setMsg({ success: '', errors: errs }); return; }
    const row = { plate_number: plate, max_capacity_kg: cap };
    const res = editing
      ? await supabase.from('truck').update(row).eq('truck_id', editing.truck_id)
      : await supabase.from('truck').insert(row);
    if (res.error) { setMsg({ success: '', errors: [explain(res.error)] }); return; }
    setMsg({ success: editing ? 'Truck updated.' : 'Truck added. The Barangay Admin can now assign it to collectors.', errors: [] });
    setForm({ key: null, plate: '', cap: '' });
    setEdit(0);
    reload();
  };

  const remove = async (t) => {
    const ok = await confirmDialog({
      title: `Remove truck ${t.plate}?`,
      message: t.crew.length ? `${t.crew.length} collector(s) will be left without a truck until the Barangay Admin reassigns them.` : 'This truck has no crew.',
      action: 'Remove truck',
    });
    if (!ok) return;
    const { error: err } = await supabase.from('truck').delete().eq('truck_id', t.id);
    setMsg(err ? { success: '', errors: [explain(err)] } : { success: 'Truck removed. Its collectors now have no truck assigned.', errors: [] });
    if (editId === t.id) setEdit(0);
    reload();
  };

  return (
    <>
      <PageHead title="Trucks" desc="The collection fleet. Barangay Admins assign these trucks to collectors." />
      <Messages success={msg.success} errors={msg.errors} />
      {error && <LoadError message={error} onRetry={reload} />}
      {ops && (
        <section className="panel mb">
          <div className="panel-head"><h2>{editing ? `Edit ${editing.plate_number}` : 'Add a truck'}</h2>
            {editing && <button type="button" className="panel-link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setEdit(0)}>Cancel</button>}</div>
          <form className="panel-body" onSubmit={save}>
            <div className="form-grid">
              <div className="field"><label htmlFor="plate_number">Plate number</label>
                <input className="input" id="plate_number" maxLength={20} value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} required /></div>
              <div className="field"><label htmlFor="max_capacity_kg">Maximum load (kg)</label>
                <input className="input" type="number" min="1" step="0.01" id="max_capacity_kg" value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} required /></div>
            </div>
            <div className="btn-row" style={{ marginTop: 16 }}><button className="btn btn-primary" type="submit"><Icon name="check" />{editing ? 'Save changes' : 'Add truck'}</button></div>
          </form>
        </section>
      )}
      {loading && !ops && <Loading />}
      {ops && (
        <section className="panel mb"><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Plate</th><th className="num">Max load</th><th>Crew</th><th>Zones</th><th>Today</th><th>Status</th><th /></tr></thead>
          <tbody>
            {!trucks.length && <tr><td colSpan={7}><Empty icon="truck" title="No trucks yet" text="Add the fleet's trucks above." /></td></tr>}
            {trucks.map((t) => {
              const [css, label] = STATE_CHIP[t.state];
              return (
                <tr key={t.id}>
                  <td><strong>{t.plate}</strong></td>
                  <td className="num">{t.capacity !== null ? `${t.capacity.toLocaleString('en-PH')} kg` : '–'}</td>
                  <td>{t.crew.length ? t.crew.join(', ') : <span className="muted">None</span>}</td>
                  <td>{t.zones.length ? t.zones.join(', ') : '–'}</td>
                  <td>{t.today_total ? `${t.today_done} of ${t.today_total} pickups` : <span className="muted">None</span>}</td>
                  <td><span className={`chip ${css}`}>{label}</span><div className="muted">GPS {t.last_seen}</div></td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMsg({ success: '', errors: [] }); setEdit(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="edit" />Edit</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(t)}><Icon name="trash" />Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></section>
      )}
    </>
  );
}
