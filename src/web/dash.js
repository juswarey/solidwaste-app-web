import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Icon, P } from './icons';

/** Live clock + date used by the top bar and the landing header. */
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    time: `${pad(h)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`,
    date: now.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

/** Equal columns, like CSS grid. `cols` is a number, or a function of the window width (return null to auto-fit with `min`). */
export function Grid({ cols, min, gap = 16, children, style }) {
  const { width } = useWindowDimensions();
  const [w, setW] = useState(0);
  const items = React.Children.toArray(children);
  const fixed = typeof cols === 'function' ? cols(width) : cols;
  // `min` = CSS auto-fit/minmax(min, 1fr): as many columns as fit the measured width.
  const n = fixed ?? Math.max(1, Math.floor((w + gap) / ((min ?? 300) + gap)));
  const cw = w ? (w - gap * (n - 1)) / n : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {w > 0 && items.map((c, i) => <View key={i} style={{ width: Math.floor(cw), minWidth: 0 }}>{c}</View>)}
    </View>
  );
}

/** Columns with different weights (e.g. 1.6fr / 1fr) that stack under `stackBelow` px. */
export function Split({ ratios, gap = 16, stackBelow = 900, children, style }) {
  const { width } = useWindowDimensions();
  const stacked = width <= stackBelow;
  const items = React.Children.toArray(children);
  return (
    <View style={[{ flexDirection: stacked ? 'column' : 'row', gap }, style]}>
      {items.map((c, i) => <View key={i} style={{ flex: stacked ? undefined : ratios[i], minWidth: 0 }}>{c}</View>)}
    </View>
  );
}

/** White rounded card, one style per PHP dashboard so the two keep their own look. */
export const cardStyle = (radius, border, shadow) => ({
  backgroundColor: '#fff', borderWidth: 1, borderColor: border, borderRadius: radius,
  boxShadow: shadow, overflow: 'hidden',
});

/** Card that lifts a little on hover (the .modern-stat-card / .modern-chart-card behaviour). */
export function HoverCard({ style, lift = 2, hoverShadow, children }) {
  return (
    <Pressable
      focusable={false}
      style={({ hovered }) => [style, { cursor: 'default', transform: [{ translateY: hovered ? -lift : 0 }] }, hovered && hoverShadow ? { boxShadow: hoverShadow } : null]}
    >
      {children}
    </Pressable>
  );
}

export function EmptyBox({ title, text }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 290, margin: 20, marginTop: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e0e5eb', borderRadius: 13, backgroundColor: '#fafbfc' }}>
      <View style={{ width: 48, height: 48, marginBottom: 12, borderRadius: 13, backgroundColor: '#f0f3f6', alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={P.empty} size={25} color="#9aa3af" />
      </View>
      <Text style={{ color: '#4e5968', fontSize: 13, fontWeight: '700' }}>{title}</Text>
      <Text style={{ maxWidth: 240, marginTop: 5, color: '#9ba4b1', fontSize: 11, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export const FONT_STACK = 'Inter, "Segoe UI", Arial, sans-serif';
export const DAYS_MON_FIRST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Query that falls back to a default instead of breaking the whole dashboard (the PHP pages did the same). */
export const safe = (promise, fallback) => Promise.resolve(promise).catch(() => fallback);

export function groupCount(rows, keyFn) {
  const m = new Map();
  rows.forEach((r) => { const k = keyFn(r); m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
