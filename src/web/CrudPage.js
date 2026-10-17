import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, type } from '../theme';
import { Button } from '../components/ui';
import { ConfirmModal, FormModal, Loading, Page, SmallBtn, Table } from './ui';

/**
 * Generic list + add / edit / delete page.
 *  rows, loading, error, reload   from useLoad
 *  columns                        Table columns
 *  rowKey                         primary-key column
 *  fields                         form fields (see FormModal)
 *  editFields                     optional: different form fields when editing a row
 *  toForm(row)                    optional: row -> initial form values (default: the row itself)
 *  onCreate(values)  -> void | { notice }      omit to hide the Add button
 *  onUpdate(row, values)                       omit to hide Edit
 *  onDelete(row)                               omit to hide Delete
 */
export default function CrudPage({
  title, sub, rows, loading, error, reload, columns, rowKey, fields, editFields, toForm,
  onCreate, onUpdate, onDelete, addLabel = 'Add', deleteText, empty, extraActions, headerExtra,
}) {
  const [form, setForm] = useState(null);      // { row } | { row: null } for create
  const [del, setDel] = useState(null);
  const [notice, setNotice] = useState('');

  const hasActions = onUpdate || onDelete || extraActions;

  return (
    <Page
      title={title}
      sub={sub}
      action={onCreate ? <Button title={`+ ${addLabel}`} onPress={() => setForm({ row: null })} style={{ paddingHorizontal: 22, minHeight: 44, paddingVertical: 10 }} /> : null}
    >
      {notice ? (
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <Text style={{ color: colors.primaryDark, fontSize: 14, lineHeight: 21 }}>{notice}</Text>
          <Text onPress={() => setNotice('')} style={[type.small, { marginTop: 6, color: colors.primary, fontWeight: '700' }]}>Dismiss</Text>
        </View>
      ) : null}
      {headerExtra}

      {loading || error ? (
        <Loading error={error} onRetry={reload} />
      ) : (
        <Table
          columns={columns}
          rows={rows ?? []}
          rowKey={rowKey}
          empty={empty}
          actions={hasActions ? {
            width: extraActions ? 260 : 150,
            render: (r) => (
              <>
                {extraActions ? extraActions(r, reload, setNotice) : null}
                {onUpdate ? <SmallBtn title="Edit" onPress={() => setForm({ row: r })} /> : null}
                {onDelete ? <SmallBtn title="Delete" tone="danger" onPress={() => setDel(r)} /> : null}
              </>
            ),
          } : undefined}
        />
      )}

      {form && (
        <FormModal
          title={form.row ? `Edit ${title.toLowerCase()}` : addLabel}
          fields={form.row && editFields ? editFields : fields}
          initial={form.row ? (toForm ? toForm(form.row) : form.row) : {}}
          onClose={() => setForm(null)}
          onSubmit={async (values) => {
            const res = form.row ? await onUpdate(form.row, values) : await onCreate(values);
            if (res?.notice) setNotice(res.notice);
            setForm(null);
            await reload();
          }}
        />
      )}

      {del && (
        <ConfirmModal
          title="Delete this?"
          text={deleteText ? deleteText(del) : 'This cannot be undone.'}
          onClose={() => setDel(null)}
          onConfirm={async () => {
            await onDelete(del);
            setDel(null);
            await reload();
          }}
        />
      )}
    </Page>
  );
}

/** '' -> null, numeric strings -> numbers, for the given keys. */
export function clean(values, { numbers = [], nullable = [] } = {}) {
  const out = { ...values };
  nullable.forEach((k) => { if (out[k] === '' || out[k] === undefined) out[k] = null; });
  numbers.forEach((k) => { if (out[k] !== null && out[k] !== undefined && out[k] !== '') out[k] = Number(out[k]); else if (out[k] === '') out[k] = null; });
  return out;
}
