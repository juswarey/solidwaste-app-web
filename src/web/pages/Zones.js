import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../AuthContext';
import { deleteRow, insertRow, list, updateRow } from '../../data/admin';
import { parsePath, serializePath } from '../../utils/route';
import CrudPage, { clean } from '../CrudPage';
import { useLoad } from '../useLoad';
import { type } from '../../theme';

export default function Zones() {
  const { role, profileId } = useAuth();
  const lgu = role === 'lgu_admin';
  const { data, loading, error, reload } = useLoad(async () => {
    const [routes, admins] = await Promise.all([list('route', 'zone_name'), lgu ? list('barangay_admin', 'lastname') : Promise.resolve([])]);
    return { routes: lgu ? routes : routes.filter((r) => r.barangay_admin_id === profileId), admins };
  }, [role, profileId]);
  const adminName = Object.fromEntries((data?.admins ?? []).map((a) => [a.barangay_admin_id, `${a.firstname} ${a.lastname}`]));

  return (
    <CrudPage
      title="Zones & routes"
      sub="A zone is what residents pick when they sign up. Draw the route the truck follows on the map."
      rows={data?.routes} loading={loading} error={error} reload={reload} rowKey="route_id" addLabel="Add zone"
      columns={[
        { key: 'zone_name', label: 'Zone', flex: 1.3 },
        ...(lgu ? [{ key: 'a', label: 'Barangay admin', render: (r) => <Text style={type.body}>{adminName[r.barangay_admin_id] ?? '—'}</Text> }] : []),
        { key: 'p', label: 'Route path', render: (r) => <Text style={type.body}>{parsePath(r.path_coordinates).length} points</Text> },
      ]}
      toForm={(r) => ({ ...r, route_path: parsePath(r.path_coordinates) })}
      fields={[
        { key: 'zone_name', label: 'Zone name', required: true },
        ...(lgu ? [{ key: 'barangay_admin_id', label: 'Barangay admin', type: 'select', placeholder: 'Unassigned', options: (data?.admins ?? []).map((a) => ({ value: a.barangay_admin_id, label: `${a.firstname} ${a.lastname}` })) }] : []),
        { key: 'route_path', label: 'Route path', type: 'path' },
      ]}
      onCreate={async (v) => {
        const c = clean(v, { numbers: ['barangay_admin_id'], nullable: ['barangay_admin_id'] });
        await insertRow('route', { zone_name: c.zone_name.trim(), barangay_admin_id: lgu ? c.barangay_admin_id ?? null : profileId, path_coordinates: serializePath(c.route_path) });
      }}
      onUpdate={async (r, v) => {
        const c = clean(v, { numbers: ['barangay_admin_id'], nullable: ['barangay_admin_id'] });
        await updateRow('route', 'route_id', r.route_id, {
          zone_name: c.zone_name.trim(), path_coordinates: serializePath(c.route_path),
          ...(lgu ? { barangay_admin_id: c.barangay_admin_id ?? null } : {}),
        });
      }}
      onDelete={(r) => deleteRow('route', 'route_id', r.route_id)}
      deleteText={(r) => `Delete zone “${r.zone_name}”? Its schedules are deleted too, and residents in it will need to choose a new zone.`}
    />
  );
}
