import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../AuthContext';
import { deleteRow, fullName, insertRow, list, updateRow } from '../../data/admin';
import { fmtRange, DAYS } from '../../utils/schedule';
import CrudPage, { clean } from '../CrudPage';
import { Badge } from '../ui';
import { useLoad } from '../useLoad';
import { type } from '../../theme';

const WEEK = [...DAYS.slice(1), DAYS[0]];

export default function Schedules() {
  const { role, profileId } = useAuth();
  const lgu = role === 'lgu_admin';
  const { data, loading, error, reload } = useLoad(async () => {
    const [schedules, routes, collectors, cats] = await Promise.all([
      list('collection_schedule'), list('route', 'zone_name'), list('garbage_collector', 'last_name'), list('waste_category', 'category_name'),
    ]);
    const myRoutes = lgu ? routes : routes.filter((r) => r.barangay_admin_id === profileId);
    const ids = new Set(myRoutes.map((r) => r.route_id));
    const rows = schedules
      .filter((s) => ids.has(s.route_id))
      .sort((a, b) => WEEK.indexOf(a.day_of_week) - WEEK.indexOf(b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)));
    return { rows, routes: myRoutes, collectors, cats };
  }, [role, profileId]);

  const zone = Object.fromEntries((data?.routes ?? []).map((r) => [r.route_id, r.zone_name]));
  const cat = Object.fromEntries((data?.cats ?? []).map((c) => [c.waste_category_id, c.category_name]));
  const col = Object.fromEntries((data?.collectors ?? []).map((c) => [c.garbage_collector_id, fullName(c)]));

  const payload = (v) => {
    const c = clean(v, { numbers: ['route_id', 'garbage_collector_id', 'waste_category_id'], nullable: ['garbage_collector_id', 'waste_category_id', 'end_time'] });
    const route = (data?.routes ?? []).find((r) => r.route_id === c.route_id);
    return {
      route_id: c.route_id,
      garbage_collector_id: c.garbage_collector_id ?? null,
      waste_category_id: c.waste_category_id ?? null,
      day_of_week: c.day_of_week,
      start_time: c.start_time,
      end_time: c.end_time ?? null,
      schedule_status: c.schedule_status || 'Active',
      barangay_admin_id: lgu ? route?.barangay_admin_id ?? null : profileId,
    };
  };

  return (
    <CrudPage
      title="Collection schedules"
      sub="The weekly pickups residents and collectors see. Assigning a collector also moves them onto that zone."
      rows={data?.rows} loading={loading} error={error} reload={reload} rowKey="collection_schedule_id" addLabel="Add pickup"
      empty="No pickups yet. Add a zone first, then schedule its pickups."
      columns={[
        { key: 'z', label: 'Zone', render: (r) => <Text style={type.body}>{zone[r.route_id] ?? '—'}</Text> },
        { key: 'd', label: 'Day', render: (r) => <Text style={type.body}>{r.day_of_week}</Text> },
        { key: 't', label: 'Time', render: (r) => <Text style={type.body}>{fmtRange(r.start_time, r.end_time)}</Text> },
        { key: 'c', label: 'Waste', render: (r) => <Text style={type.body}>{cat[r.waste_category_id] ?? 'General'}</Text> },
        { key: 'g', label: 'Collector', render: (r) => <Text style={type.body}>{col[r.garbage_collector_id] ?? 'Unassigned'}</Text> },
        { key: 's', label: 'Status', render: (r) => <Badge text={r.schedule_status ?? 'Active'} tone={r.schedule_status === 'Active' ? 'green' : 'gray'} /> },
      ]}
      fields={[
        { key: 'route_id', label: 'Zone', type: 'select', required: true, options: (data?.routes ?? []).map((r) => ({ value: r.route_id, label: r.zone_name })) },
        { key: 'day_of_week', label: 'Day', type: 'select', required: true, options: WEEK.map((d) => ({ value: d, label: d })) },
        { key: 'start_time', label: 'Start time', type: 'time', required: true },
        { key: 'end_time', label: 'End time', type: 'time' },
        { key: 'waste_category_id', label: 'Waste category', type: 'select', placeholder: 'General waste', options: (data?.cats ?? []).map((c) => ({ value: c.waste_category_id, label: c.category_name })) },
        { key: 'garbage_collector_id', label: 'Collector', type: 'select', placeholder: 'Unassigned', options: (data?.collectors ?? []).map((c) => ({ value: c.garbage_collector_id, label: fullName(c) })) },
        { key: 'schedule_status', label: 'Status', type: 'select', placeholder: 'Active', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
      ]}
      onCreate={async (v) => { await insertRow('collection_schedule', payload(v)); }}
      onUpdate={async (r, v) => { await updateRow('collection_schedule', 'collection_schedule_id', r.collection_schedule_id, payload(v)); }}
      onDelete={(r) => deleteRow('collection_schedule', 'collection_schedule_id', r.collection_schedule_id)}
      deleteText={(r) => `Delete the ${r.day_of_week} pickup in ${zone[r.route_id] ?? 'this zone'}?`}
    />
  );
}
