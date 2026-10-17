import React, { createElement, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { DEFAULT_REGION } from '../config';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

let loader = null;
/** Loads Leaflet (free OpenStreetMap maps) once, straight from a CDN. Web only. */
function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.L) return Promise.resolve(window.L);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = LEAFLET_JS;
    js.onload = () => resolve(window.L);
    js.onerror = () => { loader = null; reject(new Error('Could not load the map. Check your internet connection.')); };
    document.head.appendChild(js);
  });
  return loader;
}

/**
 * props:
 *  lines:        [{ id, color, points: [{latitude, longitude}] }]
 *  markers:      [{ id, latitude, longitude, label, color }]
 *  editablePath: [{latitude, longitude}]   (click map to add points)
 *  onEditPath:   (newPoints) => void
 */
export default function LeafletMap({ height = 420, lines = [], markers = [], editablePath, onEditPath }) {
  const box = useRef(null);
  const state = useRef({ map: null, layer: null, fitted: false });
  const editRef = useRef({ path: editablePath, cb: onEditPath });
  editRef.current = { path: editablePath, cb: onEditPath };

  const draw = () => {
    const L = window.L;
    const { map, layer } = state.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const bounds = [];

    lines.forEach((ln) => {
      const pts = ln.points.map((p) => [p.latitude, p.longitude]);
      if (pts.length > 1) L.polyline(pts, { color: ln.color || '#2e7d32', weight: 4, opacity: 0.85 }).addTo(layer);
      bounds.push(...pts);
    });

    if (editablePath) {
      const pts = editablePath.map((p) => [p.latitude, p.longitude]);
      if (pts.length > 1) L.polyline(pts, { color: '#2e7d32', weight: 4 }).addTo(layer);
      pts.forEach((p, i) => {
        L.circleMarker(p, { radius: 6, color: '#1b5e20', fillColor: i === 0 ? '#1976d2' : '#fff', fillOpacity: 1, weight: 2 })
          .bindTooltip(String(i + 1)).addTo(layer);
      });
      bounds.push(...pts);
    }

    markers.forEach((m) => {
      const c = L.circleMarker([m.latitude, m.longitude], { radius: 9, color: '#fff', weight: 2, fillColor: m.color || '#f57c00', fillOpacity: 1 }).addTo(layer);
      if (m.label) c.bindTooltip(m.label, { direction: 'top' });
      bounds.push([m.latitude, m.longitude]);
    });

    // Fit once when there is something to show; don't jump around while editing/polling.
    if (!state.current.fitted && bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      state.current.fitted = true;
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !box.current || state.current.map) return;
      const map = L.map(box.current).setView([DEFAULT_REGION.latitude, DEFAULT_REGION.longitude], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      state.current.map = map;
      state.current.layer = L.layerGroup().addTo(map);
      map.on('click', (e) => {
        const { path, cb } = editRef.current;
        if (cb) cb([...(path ?? []), { latitude: +e.latlng.lat.toFixed(6), longitude: +e.latlng.lng.toFixed(6) }]);
      });
      draw();
      setTimeout(() => map.invalidateSize(), 200);
    }).catch(() => {});
    return () => {
      cancelled = true;
      state.current.map?.remove();
      state.current = { map: null, layer: null, fitted: false };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw);

  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#dfe4df', backgroundColor: '#e8ede8' }}>
      {createElement('div', { ref: box, style: { width: '100%', height: '100%' } })}
    </View>
  );
}
