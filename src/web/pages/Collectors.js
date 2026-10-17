import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../AuthContext';
import { fullName, list, updateRow } from '../../data/admin';
import { checkPassword, staffAction } from '../../data/staff';
import CrudPage, { clean } from '../CrudPage';
import { useLoad } from '../useLoad';
import { createdNotice, loginCell } from './BarangayAdmins';
import { type } from '../../theme';

export default function Collectors() {
  const { role } = useAuth();
  const lgu = role === 'lgu_admin';
  const { data, loading, error, reload } = useLoad(async () => {
    const [collectors, trucks, routes] = await Promise.all([list('garbage_collector', 'last_name'), list('truck', 'plate_number'), list('route', 'zone_name')]);
    return { collectors, trucks, routes };
  });
  const truck = Object.fromEntries((data?.trucks ?? []).map((t) => [t.truck_id, t.plate_number]));
  const zone = Object.fromEntries((data?.routes ?? []).map((r) => [r.route_id, r.zone_name]));

  const payload = (v) => {
    const c = clean(v, { numbers: ['truck_id', 'route_id'], nullable: ['truck_id', 'route_id'] });
    return { first_name: c.first_name.trim(), last_name: c.last_name.trim(), truck_id: c.truck_id ?? null, route_id: c.route_id ?? null };
  };
  const assign = [
    { key: 'truck_id', label: 'Truck', type: 'select', placeholder: 'No truck', options: (data?.trucks ?? []).map((t) => ({ value: t.truck_id, label: t.plate_number })) },
    { key: 'route_id', label: 'Zone', type: 'select', placeholder: 'No zone', options: (data?.routes ?? []).map((r) => ({ value: r.route_id, label: r.zone_name })) },
  ];
  const names = [
    { key: 'first_name', label: 'First name', required: true },
    { key: 'last_name', label: 'Last name', required: true },
  ];

  return (
    <CrudPage
      title="Garbage collectors"
      sub={lgu ? 'Create each collector’s login here. They sign in to the phone app with the email and password you set.' : 'Collectors on your routes, or not yet assigned.'}
      rows={data?.collectors} loading={loading} error={error} reload={reload} rowKey="garbage_collector_id" addLabel="Add collector"
      columns={[
        { key: 'n', label: 'Name', render: (r) => <Text style={type.body}>{fullName(r)}</Text> },
        { key: 'email', label: 'Email (login)', flex: 1.3 },
        { key: 't', label: 'Truck', render: (r) => <Text style={type.body}>{truck[r.truck_id] ?? '—'}</Text> },
        { key: 'z', label: 'Zone', render: (r) => <Text style={type.body}>{zone[r.route_id] ?? '—'}</Text> },
        ...(lgu ? [{ key: 's', label: 'Login', render: loginCell }] : []),
      ]}
      fields={[...names, { key: 'email', label: 'Email (used to log in)', type: 'email', required: true }, { key: 'password', label: 'Password (8+ characters)', type: 'password', placeholder: 'You choose it and hand it over', required: true }, ...assign]}
      editFields={[...names, { key: 'email', label: 'Email (login — cannot be changed)', type: 'readonly' }, { key: 'password', label: 'New password (leave blank to keep the current one)', type: 'password' }, ...assign]}
      onCreate={lgu ? async (v) => {
        checkPassword(v.password);
        const p = payload(v);
        const email = v.email.trim().toLowerCase();
        await staffAction('create', { role: 'garbage_collector', email, password: v.password, ...p });
        return { notice: createdNotice('Collector', email) };
      } : undefined}
      onUpdate={lgu ? async (r, v) => {
        if (v.password) { checkPassword(v.password); await staffAction('set_password', { role: 'garbage_collector', id: r.garbage_collector_id, password: v.password }); }
        await updateRow('garbage_collector', 'garbage_collector_id', r.garbage_collector_id, payload(v));
        return v.password ? { notice: `Password updated for ${r.email}.` } : undefined;
      } : undefined}
      onDelete={lgu ? (r) => staffAction('delete', { role: 'garbage_collector', id: r.garbage_collector_id }) : undefined}
      deleteText={(r) => `Remove ${fullName(r)}? Their login is deleted too and their schedule slots become unassigned.`}
    />
  );
}
