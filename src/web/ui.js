import React, { createElement, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { colors, radius, type } from '../theme';
import { Button, ErrorBanner, Field } from '../components/ui';
import LeafletMap from './LeafletMap';

export const useIsNarrow = () => useWindowDimensions().width < 860;

export function Page({ title, sub, action, children }) {
  return (
    <View style={{ width: '100%', maxWidth: 1180, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 20 }}>
        <View style={{ flexShrink: 1, marginRight: 16 }}>
          <Text style={type.title}>{title}</Text>
          {sub ? <Text style={[type.small, { marginTop: 4 }]}>{sub}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SmallBtn({ title, onPress, tone = 'default', disabled }) {
  const danger = tone === 'danger';
  const solid = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, marginLeft: 6,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.primary,
        backgroundColor: solid ? colors.primary : 'transparent',
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: solid ? '#fff' : danger ? colors.danger : colors.primary }}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ text, tone = 'green' }) {
  const t = { green: [colors.primaryLight, colors.primaryDark], amber: [colors.amberLight, colors.amber], blue: ['#e3f2fd', colors.blue], gray: ['#eceff1', colors.muted], red: [colors.dangerLight, colors.danger] }[tone];
  return (
    <View style={{ backgroundColor: t[0], borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: t[1], fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Panel({ children, style }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 }, style]}>
      {children}
    </View>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 18, minWidth: 170, flexGrow: 1, flexBasis: 170, marginRight: 12, marginBottom: 12 }}>
      <Text style={type.small}>{label}</Text>
      <Text style={{ fontSize: 32, fontWeight: '800', color: tone === 'amber' ? colors.amber : colors.primaryDark, marginTop: 4 }}>{value ?? '–'}</Text>
    </View>
  );
}

export function Loading({ error, onRetry }) {
  if (error) {
    return (
      <Panel>
        <Text style={[type.heading, { marginBottom: 6 }]}>Couldn’t load this</Text>
        <Text style={[type.small, { marginBottom: 12 }]}>{error}</Text>
        {onRetry ? <SmallBtn title="Try again" onPress={onRetry} /> : null}
      </Panel>
    );
  }
  return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 60 }} />;
}

/** Simple table. columns: [{ key, label, flex, render(row) }] */
export function Table({ columns, rows, rowKey, empty = 'Nothing here yet.', actions }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <ScrollView horizontal contentContainerStyle={{ minWidth: '100%', flexDirection: 'column' }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f1', paddingVertical: 10, paddingHorizontal: 14, minWidth: 720 }}>
          {columns.map((c) => (
            <Text key={c.key} style={[type.small, { flex: c.flex ?? 1, fontWeight: '700', color: colors.text }]}>{c.label}</Text>
          ))}
          {actions ? <View style={{ width: actions.width ?? 150 }} /> : null}
        </View>
        {rows.length === 0 ? (
          <Text style={[type.small, { padding: 24, textAlign: 'center' }]}>{empty}</Text>
        ) : (
          rows.map((r) => (
            <View key={r[rowKey]} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.border, minWidth: 720 }}>
              {columns.map((c) => (
                <View key={c.key} style={{ flex: c.flex ?? 1, paddingRight: 10 }}>
                  {c.render ? c.render(r) : <Text style={type.body} numberOfLines={3}>{r[c.key] ?? '—'}</Text>}
                </View>
              ))}
              {actions ? <View style={{ width: actions.width ?? 150, flexDirection: 'row', justifyContent: 'flex-end' }}>{actions.render(r)}</View> : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const inputCss = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, color: colors.text,
  border: `1px solid ${colors.border}`, borderRadius: radius.md, background: '#fff', fontFamily: 'inherit',
};

export function Select({ label, value, onChange, options, placeholder = 'Choose…' }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text> : null}
      {createElement(
        'select',
        { value: value ?? '', onChange: (e) => onChange(e.target.value === '' ? null : e.target.value), style: inputCss },
        createElement('option', { value: '' }, placeholder),
        options.map((o) => createElement('option', { key: String(o.value), value: String(o.value) }, o.label))
      )}
    </View>
  );
}

export function TimeInput({ label, value, onChange }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text> : null}
      {createElement('input', {
        type: 'time', value: value ? String(value).slice(0, 5) : '',
        onChange: (e) => onChange(e.target.value ? `${e.target.value}:00` : null), style: inputCss,
      })}
    </View>
  );
}

/** Click-to-draw route path editor. */
export function PathEditor({ label, value, onChange }) {
  const pts = value ?? [];
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={type.label}>{label} ({pts.length} points)</Text>
        <View style={{ flexDirection: 'row' }}>
          <SmallBtn title="Undo last" onPress={() => onChange(pts.slice(0, -1))} disabled={!pts.length} />
          <SmallBtn title="Clear" tone="danger" onPress={() => onChange([])} disabled={!pts.length} />
        </View>
      </View>
      <LeafletMap height={320} editablePath={pts} onEditPath={onChange} />
      <Text style={[type.small, { marginTop: 6 }]}>Click the map to add points along the collection route, in the order the truck drives.</Text>
    </View>
  );
}

/** Modal form driven by a `fields` list: text | number | textarea | select | time | path | readonly | password */
export function FormModal({ title, fields, initial, submitLabel = 'Save', onSubmit, onClose }) {
  const [v, setV] = useState(() => ({ ...initial }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    for (const f of fields) {
      if (f.required && (v[f.key] === undefined || v[f.key] === null || String(v[f.key]).trim() === '')) {
        return setError(`${f.label} is required.`);
      }
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(v);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,30,20,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, width: '100%', maxWidth: 640, maxHeight: '92%' }}>
          <View style={{ padding: 20, paddingBottom: 8 }}>
            <Text style={type.heading}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12 }} keyboardShouldPersistTaps="handled">
            <ErrorBanner message={error} />
            {fields.map((f) => {
              if (f.type === 'select') return <Select key={f.key} label={f.label} value={v[f.key]} onChange={set(f.key)} options={f.options ?? []} placeholder={f.placeholder} />;
              if (f.type === 'time') return <TimeInput key={f.key} label={f.label} value={v[f.key]} onChange={set(f.key)} />;
              if (f.type === 'path') return <PathEditor key={f.key} label={f.label} value={v[f.key]} onChange={set(f.key)} />;
              if (f.type === 'readonly') return (
                <View key={f.key} style={{ marginBottom: 14 }}>
                  <Text style={[type.label, { marginBottom: 6 }]}>{f.label}</Text>
                  <Text style={type.body}>{String(v[f.key] ?? '—')}</Text>
                </View>
              );
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  value={v[f.key] == null ? '' : String(v[f.key])}
                  onChangeText={set(f.key)}
                  multiline={f.type === 'textarea'}
                  keyboardType={f.type === 'number' ? 'numeric' : undefined}
                  autoCapitalize={f.type === 'email' || f.type === 'password' ? 'none' : undefined}
                  secureTextEntry={f.type === 'password'}
                  autoComplete={f.type === 'password' ? 'new-password' : undefined}
                  placeholder={f.placeholder}
                />
              );
            })}
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
              <Button title={submitLabel} onPress={submit} loading={busy} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ConfirmModal({ title, text, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,30,20,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, width: '100%', maxWidth: 440, padding: 22 }}>
          <Text style={type.heading}>{title}</Text>
          <Text style={[type.body, { marginVertical: 12 }]}>{text}</Text>
          <ErrorBanner message={error} />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
            <Button
              title={confirmLabel}
              loading={busy}
              style={{ flex: 1, backgroundColor: colors.danger }}
              onPress={async () => {
                setBusy(true);
                try { await onConfirm(); } catch (e) { setError(e.message); setBusy(false); }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
