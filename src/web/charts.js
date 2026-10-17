import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { chartBar, chartPalette } from './design';

/**
 * Static SVG charts that look like the Chart.js ones on the PHP dashboards
 * (no animation, no tooltips, rounded bars, thin grid, circle legend).
 * Web only. They only draw what they are given; no data access in here.
 */
const AXIS = '#a0a8b5';
const GRID = '#edf0f4';
const NICE = (max) => {
  if (max <= 5) return Math.max(1, Math.ceil(max));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
};

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

const roundedTop = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
};
const roundedRight = (x, y, w, h, r) => {
  r = Math.min(r, h / 2, w);
  if (w <= 0) return '';
  return `M${x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x},${y + h} Z`;
};

/** Vertical bars (`horizontal` = false) or horizontal bars. */
export function BarChart({ labels, values, height = 285, horizontal = false, color = chartBar }) {
  const [w, onLayout] = useWidth();
  const max = NICE(Math.max(1, ...values));
  const ticks = 5;
  const pad = horizontal ? { l: 8, r: 8, t: 8, b: 26 } : { l: 34, r: 8, t: 8, b: 28 };
  const longest = Math.max(0, ...labels.map((l) => String(l).length));
  if (horizontal) pad.l = Math.min(160, Math.max(60, longest * 6.5 + 14));

  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = Math.max(0, height - pad.t - pad.b);
  const n = Math.max(1, labels.length);

  return (
    <View style={{ width: '100%', height }} onLayout={onLayout}>
      {w > 0 && (
        <svg width={w} height={height} style={{ display: 'block', overflow: 'visible' }}>
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const v = (max / ticks) * i;
            if (horizontal) {
              const x = pad.l + (iw / ticks) * i;
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={pad.t} y2={pad.t + ih} stroke={GRID} />
                  <text x={x} y={height - 8} fontSize="12" fill={AXIS} textAnchor="middle">{Number.isInteger(v) ? v : v.toFixed(1)}</text>
                </g>
              );
            }
            const y = pad.t + ih - (ih / ticks) * i;
            return (
              <g key={i}>
                <line x1={pad.l} x2={pad.l + iw} y1={y} y2={y} stroke={GRID} />
                <text x={pad.l - 10} y={y + 4} fontSize="12" fill={AXIS} textAnchor="end">{Number.isInteger(v) ? v : v.toFixed(1)}</text>
              </g>
            );
          })}
          {labels.map((label, i) => {
            const val = values[i] ?? 0;
            if (horizontal) {
              const band = ih / n;
              const bh = band * 0.58; // barPercentage .58 of the category band
              const y = pad.t + band * i + (band - bh) / 2;
              const bw = (val / max) * iw;
              return (
                <g key={label + i}>
                  <path d={roundedRight(pad.l, y, bw, bh, 8)} fill={color} />
                  <text x={pad.l - 10} y={y + bh / 2 + 4} fontSize="12" fill="#697586" textAnchor="end">{String(label).length > 22 ? `${String(label).slice(0, 21)}…` : label}</text>
                </g>
              );
            }
            const band = iw / n;
            const bw = band * 0.58;
            const x = pad.l + band * i + (band - bw) / 2;
            const bh = (val / max) * ih;
            return (
              <g key={label + i}>
                <path d={roundedTop(x, pad.t + ih - bh, bw, bh, 8)} fill={color} />
                <text x={pad.l + band * i + band / 2} y={height - 8} fontSize="12" fill="#8b95a5" textAnchor="middle">{label}</text>
              </g>
            );
          })}
        </svg>
      )}
    </View>
  );
}

/** Doughnut with an optional centre label and a circle-style legend underneath. */
export function DoughnutChart({ labels, values, cutout = 0.76, centerValue, centerLabel, size = 235 }) {
  const total = values.reduce((a, b) => a + b, 0);
  const R = size / 2;
  const r = R * cutout;
  const gap = 0.045; // radians of spacing between arcs
  let a0 = -Math.PI / 2;
  const arcs = values.map((v, i) => {
    const sweep = total ? (v / total) * Math.PI * 2 : 0;
    const s = a0 + gap / 2;
    const e = a0 + sweep - gap / 2;
    a0 += sweep;
    if (sweep <= gap) return null;
    const p = (ang, rad) => [R + rad * Math.cos(ang), R + rad * Math.sin(ang)];
    const [x1, y1] = p(s, R - 1), [x2, y2] = p(e, R - 1), [x3, y3] = p(e, r), [x4, y4] = p(s, r);
    const large = e - s > Math.PI ? 1 : 0;
    const d = `M${x1},${y1} A${R - 1},${R - 1} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z`;
    return <path key={i} d={d} fill={chartPalette[i % chartPalette.length]} stroke={chartPalette[i % chartPalette.length]} strokeWidth="6" strokeLinejoin="round" />;
  });

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block' }}>
          {total === 0 ? <circle cx={R} cy={R} r={(R + r) / 2} fill="none" stroke="#edf0f4" strokeWidth={R - r} /> : arcs}
          {centerValue != null && (
            <>
              <text x={R} y={R - 2} textAnchor="middle" fontSize="30" fontWeight="700" fill="#17202a">{centerValue}</text>
              <text x={R} y={R + 22} textAnchor="middle" fontSize="11" fontWeight="500" fill="#8b95a5">{centerLabel}</text>
            </>
          )}
        </svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
        {labels.map((l, i) => (
          <View key={l + i} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 9, marginBottom: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chartPalette[i % chartPalette.length], marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#8b95a5' }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
