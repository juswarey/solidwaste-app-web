import React from 'react';
import { Text } from 'react-native';
import { deleteRow, list, updateRow } from '../../data/admin';
import { checkPassword, staffAction } from '../../data/staff';
import { Badge } from '../ui';
import CrudPage from '../CrudPage';
import { useLoad } from '../useLoad';
import { type } from '../../theme';

export const loginCell = (r) => (r.auth_user_id ? <Badge text="Can log in" /> : <Badge text="No login" tone="amber" />);

export const createdNotice = (who, email) =>
  `${who} account created. They can log in right away with ${email} and the password you just set — give it to them privately.`;

const PASSWORD_ON_CREATE = { key: 'password', label: 'Password (8+ characters)', type: 'password', placeholder: 'You choose it and hand it over' };
const PASSWORD_ON_EDIT = { key: 'password', label: 'New password (leave blank to keep the current one)', type: 'password' };

export default function BarangayAdmins() {
  const { data, loading, error, reload } = useLoad(() => list('barangay_admin', 'lastname'));
  const names = [
    { key: 'firstname', label: 'First name', required: true },
    { key: 'lastname', label: 'Last name', required: true },
  ];
  return (
    <CrudPage
      title="Barangay admins"
      sub="Create a login for each barangay’s administrator. Only you (the LGU admin) can add them."
      rows={data} loading={loading} error={error} reload={reload} rowKey="barangay_admin_id" addLabel="Add barangay admin"
      columns={[
        { key: 'n', label: 'Name', render: (r) => <Text style={type.body}>{`${r.firstname ?? ''} ${r.lastname ?? ''}`}</Text> },
        { key: 'email', label: 'Email (login)', flex: 1.3 },
        { key: 's', label: 'Login', render: loginCell },
      ]}
      fields={[...names, { key: 'email', label: 'Email (used to log in)', type: 'email', required: true }, { ...PASSWORD_ON_CREATE, required: true }]}
      editFields={[...names, { key: 'email', label: 'Email (login — cannot be changed)', type: 'readonly' }, PASSWORD_ON_EDIT]}
      onCreate={async (v) => {
        checkPassword(v.password);
        const email = v.email.trim().toLowerCase();
        await staffAction('create', { role: 'barangay_admin', email, password: v.password, first_name: v.firstname.trim(), last_name: v.lastname.trim() });
        return { notice: createdNotice('Barangay admin', email) };
      }}
      onUpdate={async (r, v) => {
        if (v.password) { checkPassword(v.password); await staffAction('set_password', { role: 'barangay_admin', id: r.barangay_admin_id, password: v.password }); }
        await updateRow('barangay_admin', 'barangay_admin_id', r.barangay_admin_id, { firstname: v.firstname.trim(), lastname: v.lastname.trim() });
        return v.password ? { notice: `Password updated for ${r.email}.` } : undefined;
      }}
      onDelete={(r) => staffAction('delete', { role: 'barangay_admin', id: r.barangay_admin_id })}
      deleteText={(r) => `Remove ${r.firstname} ${r.lastname}? Their login is deleted too. Their zones keep existing but lose their barangay admin.`}
    />
  );
}
