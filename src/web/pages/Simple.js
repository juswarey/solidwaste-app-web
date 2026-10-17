import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../AuthContext';
import { deleteRow, fullName, insertRow, list, updateRow } from '../../data/admin';
import { fmtDateTime } from '../../utils/schedule';
import CrudPage, { clean } from '../CrudPage';
import { Badge } from '../ui';
import { useLoad } from '../useLoad';
import { type } from '../../theme';

export function Trucks() {
  const { data, loading, error, reload } = useLoad(() => list('truck', 'plate_number'));
  const payload = (v) => { const c = clean(v, { numbers: ['max_capacity_kg'], nullable: ['max_capacity_kg'] }); return { plate_number: c.plate_number.trim(), max_capacity_kg: c.max_capacity_kg ?? null }; };
  return (
    <CrudPage
      title="Trucks" sub="Trucks you can assign to collectors."
      rows={data} loading={loading} error={error} reload={reload} rowKey="truck_id" addLabel="Add truck"
      columns={[
        { key: 'plate_number', label: 'Plate number' },
        { key: 'c', label: 'Capacity', render: (r) => <Text style={type.body}>{r.max_capacity_kg != null ? `${Number(r.max_capacity_kg).toLocaleString('en-US')} kg` : '—'}</Text> },
      ]}
      fields={[
        { key: 'plate_number', label: 'Plate number', required: true },
        { key: 'max_capacity_kg', label: 'Capacity (kg)', type: 'number' },
      ]}
      onCreate={async (v) => { await insertRow('truck', payload(v)); }}
      onUpdate={async (r, v) => { await updateRow('truck', 'truck_id', r.truck_id, payload(v)); }}
      onDelete={(r) => deleteRow('truck', 'truck_id', r.truck_id)}
      deleteText={(r) => `Delete truck ${r.plate_number}?`}
    />
  );
}

export function WasteCategories() {
  const { data, loading, error, reload } = useLoad(() => list('waste_category', 'category_name'));
  const payload = (v) => ({ category_name: v.category_name.trim(), disposal_guidelines: v.disposal_guidelines?.trim() || null });
  return (
    <CrudPage
      title="Waste categories" sub="Shown to residents in the Waste guide, with how to prepare each kind for pickup."
      rows={data} loading={loading} error={error} reload={reload} rowKey="waste_category_id" addLabel="Add category"
      columns={[
        { key: 'category_name', label: 'Category' },
        { key: 'disposal_guidelines', label: 'Disposal guidelines', flex: 2.5 },
      ]}
      fields={[
        { key: 'category_name', label: 'Category name', required: true },
        { key: 'disposal_guidelines', label: 'Disposal guidelines', type: 'textarea' },
      ]}
      onCreate={async (v) => { await insertRow('waste_category', payload(v)); }}
      onUpdate={async (r, v) => { await updateRow('waste_category', 'waste_category_id', r.waste_category_id, payload(v)); }}
      onDelete={(r) => deleteRow('waste_category', 'waste_category_id', r.waste_category_id)}
      deleteText={(r) => `Delete “${r.category_name}”?`}
    />
  );
}

export function Announcements() {
  const { role, profileId } = useAuth();
  const lgu = role === 'lgu_admin';
  const { data, loading, error, reload } = useLoad(() => list('announcement', 'published_timestamp', false));
  return (
    <CrudPage
      title="Announcements" sub={lgu ? 'Posted to every resident’s News tab.' : 'Posted by the LGU. Residents see these in the app.'}
      rows={data} loading={loading} error={error} reload={reload} rowKey="announcement_id" addLabel="New announcement"
      columns={[
        { key: 'title', label: 'Title', flex: 1.2 },
        { key: 'content', label: 'Message', flex: 2.5 },
        { key: 'd', label: 'Posted', render: (r) => <Text style={type.small}>{fmtDateTime(r.published_timestamp)}</Text> },
      ]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'content', label: 'Message', type: 'textarea', required: true },
      ]}
      onCreate={lgu ? async (v) => { await insertRow('announcement', { title: v.title.trim(), content: v.content.trim(), lgu_admin_id: profileId, published_timestamp: new Date().toISOString() }); } : undefined}
      onUpdate={lgu ? async (r, v) => { await updateRow('announcement', 'announcement_id', r.announcement_id, { title: v.title.trim(), content: v.content.trim() }); } : undefined}
      onDelete={lgu ? (r) => deleteRow('announcement', 'announcement_id', r.announcement_id) : undefined}
      deleteText={(r) => `Delete “${r.title}”?`}
    />
  );
}

const STATUS = { pending: ['Received', 'amber'], in_progress: ['In progress', 'blue'], resolved: ['Resolved', 'green'] };

export function Reports() {
  const { profileId } = useAuth();
  const { data, loading, error, reload } = useLoad(async () => {
    const [reports, residents] = await Promise.all([list('feedback_report', 'created_at', false), list('resident')]);
    return { reports, residents };
  });
  const who = Object.fromEntries((data?.residents ?? []).map((r) => [r.resident_id, fullName(r)]));
  return (
    <CrudPage
      title="Resident reports" sub="Problems residents sent from the app. Update the status so they can follow progress."
      rows={data?.reports} loading={loading} error={error} reload={reload} rowKey="feedback_report_id"
      empty="No reports yet."
      columns={[
        { key: 'report_type', label: 'Type' },
        { key: 'description', label: 'Details', flex: 2.2 },
        { key: 'r', label: 'From', render: (r) => <Text style={type.body}>{who[r.resident_id] ?? '—'}</Text> },
        { key: 's', label: 'Status', render: (r) => { const s = STATUS[r.status] ?? STATUS.pending; return <Badge text={s[0]} tone={s[1]} />; } },
        {
          key: 'l', label: 'Where', render: (r) => (r.latitude != null && r.longitude != null
            ? <Text style={[type.small, { color: '#1976d2', fontWeight: '700' }]} onPress={() => window.open(`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}`, '_blank')}>View map</Text>
            : <Text style={type.small}>—</Text>),
        },
        { key: 'd', label: 'Sent', render: (r) => <Text style={type.small}>{fmtDateTime(r.created_at)}</Text> },
      ]}
      fields={[
        { key: 'report_type', label: 'Type', type: 'readonly' },
        { key: 'description', label: 'Details', type: 'readonly' },
        { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'pending', label: 'Received' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }] },
      ]}
      onUpdate={async (r, v) => { await updateRow('feedback_report', 'feedback_report_id', r.feedback_report_id, { status: v.status, lgu_admin_id: profileId }); }}
      onDelete={(r) => deleteRow('feedback_report', 'feedback_report_id', r.feedback_report_id)}
      deleteText={() => 'Delete this report?'}
    />
  );
}

export function Residents() {
  const { data, loading, error, reload } = useLoad(async () => {
    const [residents, routes] = await Promise.all([list('resident', 'last_name'), list('route', 'zone_name')]);
    return { residents, zone: Object.fromEntries(routes.map((r) => [r.route_id, r.zone_name])) };
  });
  return (
    <CrudPage
      title="Residents" sub="People who signed up in the app."
      rows={data?.residents} loading={loading} error={error} reload={reload} rowKey="resident_id"
      columns={[
        { key: 'n', label: 'Name', render: (r) => <Text style={type.body}>{fullName(r)}</Text> },
        { key: 'email', label: 'Email', flex: 1.3 },
        { key: 'contact_number', label: 'Contact' },
        { key: 'home_address', label: 'Address', flex: 1.5 },
        { key: 'z', label: 'Zone', render: (r) => <Text style={type.body}>{data.zone[r.route_id] ?? '—'}</Text> },
      ]}
      onDelete={(r) => deleteRow('resident', 'resident_id', r.resident_id)}
      deleteText={(r) => `Remove ${fullName(r)}’s resident profile? Their login still exists, so they can sign up again.`}
    />
  );
}
