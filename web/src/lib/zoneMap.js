/*
 * Interactive map of Barangay Poblacion (Leaflet + OpenStreetMap), used on both
 * dashboards and the Live map pages. Ported from assets/js/zone-map.js of the PHP version.
 *
 *   mountZoneMap({ canvas, side, load: (date) => Promise<mapPayload>, boundaryUrl,
 *                  pollMs, dateFilter, scrollZoom, showFeedback, tiles, onStatus, onZoneSelect })
 *
 * Nothing on this map is invented:
 *   - the barangay outline is the PSA/NAMRIA 2023 boundary (simplified)
 *   - zone areas are drawn only from saved boundary coordinates (dashed = provisional)
 *   - routes are drawn only from saved path coordinates
 *   - vehicles are the last GPS ping sent by the collector mobile app
 */
import L from 'leaflet';
import { esc, color, poll } from './ui';

const STATUS = {
    completed: { label: 'Completed', css: 'done', color: '#1f8a5b' },
    ongoing:   { label: 'Ongoing', css: 'ongoing', color: '#2563a8' },
    pending:   { label: 'Pending', css: 'pending', color: '#a8670e' },
    delayed:   { label: 'Delayed', css: 'delayed', color: '#c2412d' },
    upcoming:  { label: 'Upcoming', css: 'pending', color: '#a8670e' },
    untracked: { label: 'Before tracking', css: '', color: '#75837c' },
    none:      { label: 'No collection', css: '', color: '#75837c' }
};
const GPS = {
    live:   { label: 'Live', note: 'Location updated in the last few minutes' },
    recent: { label: 'Recent', note: 'Last location is under an hour old' },
    stale:  { label: 'Old position', note: 'Last location is over an hour old — not live' }
};
const truckSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h11v9h-11zM13.5 9.5H18l3.5 3.5v2.5h-8"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/></svg>';

export function mountZoneMap(opts) {
    const state = {
        data: null, selected: null, colorBy: 'status', statusFilter: 'all',
        date: null, fitted: false,
        layers: {
            boundary: L.layerGroup(), zones: L.layerGroup(), routes: L.layerGroup(),
            vehicles: L.layerGroup(), feedback: L.layerGroup(),
            points: L.layerGroup(), emergencies: L.layerGroup()
        },
        visible: { boundary: true, zones: true, routes: true, vehicles: true, feedback: !!opts.showFeedback,
                   points: true, emergencies: true }
    };

    const map = L.map(opts.canvas, { zoomControl: true, zoomSnap: 0.25, scrollWheelZoom: !!opts.scrollZoom, attributionControl: true })
        .setView([8.2290, 124.2365], 16);
    // Ctrl/⌘ + scroll zooms when scroll-zoom is off, so the page still scrolls normally.
    if (!opts.scrollZoom) {
        opts.canvas.addEventListener('wheel', function (e) {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); map.scrollWheelZoom.enable(); }
            else { map.scrollWheelZoom.disable(); }
        }, { passive: false });
    }
    const tileCfg = Object.assign({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        fallbackUrl: '', fallbackAttribution: ''
    }, opts.tiles || {});
    const boundaryCredit = ' | Boundary: PSA/NAMRIA 2023';
    let tiles = null, usingFallback = false, tileErrors = 0, tileLoads = 0;
    function addTiles(url, attribution) {
        if (tiles) map.removeLayer(tiles);
        tileErrors = 0; tileLoads = 0;
        tiles = L.tileLayer(url, {
            maxZoom: 19,
            subdomains: 'abcd',
            // Tile servers (OpenStreetMap in particular) refuse requests that carry no Referer.
            referrerPolicy: 'strict-origin-when-cross-origin',
            attribution: attribution + boundaryCredit
        }).addTo(map);
        tiles.on('tileload', function () { tileLoads++; });
        tiles.on('tileerror', function () {
            tileErrors++;
            if (tileErrors < 4 || tileLoads > 0) return;
            if (!usingFallback && tileCfg.fallbackUrl) {
                usingFallback = true;
                addTiles(tileCfg.fallbackUrl, tileCfg.fallbackAttribution || tileCfg.attribution);
                showMsg('OpenStreetMap tiles were refused, so the map switched to the CARTO street map.');
            } else {
                showMsg('Street map tiles could not load (no internet?). The boundary, zones, routes and vehicles are still shown.');
            }
        });
    }
    addTiles(tileCfg.url, tileCfg.attribution);

    Object.keys(state.layers).forEach(function (k) { if (state.visible[k]) state.layers[k].addTo(map); });

    const msg = document.createElement('div');
    msg.className = 'map-msg';
    msg.hidden = true;
    opts.canvas.appendChild(msg);
    function showMsg(text) { msg.textContent = text; msg.hidden = !text; }

    /* ---------- Side panel skeleton ---------- */
    const side = opts.side;
    side.innerHTML =
        '<div class="map-side-section">' +
            (opts.dateFilter ? '<div class="field" style="margin-bottom:10px"><label for="mapDate">Collection date</label><input class="input" type="date" id="mapDate"></div>' : '') +
            '<div class="field" style="margin-bottom:10px"><span class="label">Colour zones and routes by</span>' +
                '<div class="seg" role="group" aria-label="Colour by"><button type="button" data-colorby="status" aria-pressed="true">Status</button><button type="button" data-colorby="zone" aria-pressed="false">Zone</button></div></div>' +
            '<div class="field"><label for="mapStatus">Show zones</label><select class="select" id="mapStatus">' +
                '<option value="all">All zones</option><option value="delayed">Delayed</option><option value="ongoing">Ongoing</option>' +
                '<option value="pending">Pending / upcoming</option><option value="completed">Completed</option><option value="none">No collection that day</option></select></div>' +
        '</div>' +
        '<div class="map-side-section"><h3>Layers</h3><div class="layer-toggles">' +
            toggle('boundary', 'Barangay boundary', '<span class="layer-swatch" style="border:2px solid #14231d;background:transparent"></span>') +
            toggle('zones', 'Zone areas', '<span class="layer-swatch" style="background:#0f766e55;border:1px solid #0f766e"></span>') +
            toggle('points', 'Truck stops (fixed schedule)', '<span class="layer-swatch" style="width:12px;border-radius:3px;background:#14231d"></span>') +
            toggle('emergencies', 'Emergency collections', '<span class="layer-swatch" style="width:12px;border-radius:50%;background:#fff;border:3px solid #c2412d"></span>') +
            toggle('routes', 'Collection routes', '<span class="layer-swatch" style="height:4px;background:#2563a8"></span>') +
            toggle('vehicles', 'Collectors & trucks (GPS)', '<span class="layer-swatch" style="border-radius:50%;width:12px;background:#2563a8"></span>') +
            toggle('feedback', 'Open resident reports', '<span class="layer-swatch" style="width:10px;height:10px;transform:rotate(45deg);background:#c2412d"></span>') +
        '</div></div>' +
        '<div class="map-side-scroll"><div class="zone-info" id="zoneInfo" hidden></div><ul class="zone-list" id="zoneList" aria-label="Zones"></ul></div>' +
        '<div class="map-side-section" style="border-top:1px solid var(--line);border-bottom:0"><div class="note" id="mapLegend"></div></div>';

    function toggle(key, label, swatch) {
        return '<label><input type="checkbox" data-layer="' + key + '"' + (state.visible[key] ? ' checked' : '') + '> ' + swatch + ' ' + label + '</label>';
    }

    side.querySelectorAll('[data-layer]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            const k = cb.dataset.layer;
            state.visible[k] = cb.checked;
            if (cb.checked) state.layers[k].addTo(map); else map.removeLayer(state.layers[k]);
        });
    });
    side.querySelectorAll('[data-colorby]').forEach(function (b) {
        b.addEventListener('click', function () {
            state.colorBy = b.dataset.colorby;
            side.querySelectorAll('[data-colorby]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            render();
        });
    });
    const statusSel = side.querySelector('#mapStatus');
    statusSel.addEventListener('change', function () { state.statusFilter = statusSel.value; render(); });
    const dateInput = side.querySelector('#mapDate');
    if (dateInput) {
        dateInput.addEventListener('change', function () { state.date = dateInput.value || null; poller.refresh(); });
    }

    /* ---------- Boundary: show Barangay Poblacion only ---------- */
    // Everything outside Poblacion is covered by a mask, and panning is limited to the barangay.
    map.createPane('outside');
    map.getPane('outside').style.zIndex = 350;      // above street tiles, below zones and markers
    map.getPane('outside').style.pointerEvents = 'none';
    let maskLayer = null, extentRing = null;
    function maskColor() { return color('bg') || '#f3f5f2'; }
    function drawMask() {
        if (!extentRing) return;
        if (maskLayer) map.removeLayer(maskLayer);
        const world = [[-90, -360], [-90, 360], [90, 360], [90, -360]];
        maskLayer = L.polygon([world, extentRing], { pane: 'outside', stroke: false, fillColor: maskColor(), fillOpacity: 1, interactive: false }).addTo(map);
    }
    document.addEventListener('ecollect:theme', drawMask);
    let alive = true;   // background loads that finish after destroy() are ignored
    const cleanup = [function () { document.removeEventListener('ecollect:theme', drawMask); }];
    fetch(opts.boundaryUrl, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (geo) {
        if (!alive) return;
        const pob = geo.features.find(function (f) { return f.properties.kind === 'barangay_boundary'; });
        const ext = geo.features.find(function (f) { return f.properties.kind === 'display_extent'; }) || pob;
        if (pob) {
            L.geoJSON(pob, { style: { color: '#14231d', weight: 3, fill: false, interactive: false } }).addTo(state.layers.boundary);
        }
        if (ext) {
            extentRing = ext.geometry.coordinates[0].map(function (c) { return [c[1], c[0]]; });
            drawMask();
            const b = L.latLngBounds(extentRing);
            map.setMaxBounds(b.pad(0.35));
            map.options.maxBoundsViscosity = 0.9;
            if (!state.fitted) map.fitBounds(b, { padding: [12, 12], animate: false });
            map.setMinZoom(Math.max(14, map.getBoundsZoom(b) - 1));
        }
    }).catch(function () { if (alive) showMsg('The barangay boundary file could not be loaded.'); });

    /* ---------- Rendering ---------- */
    function zoneColor(z) {
        return state.colorBy === 'zone' ? z.color : (STATUS[z.status] || STATUS.none).color;
    }
    function passes(z) {
        const f = state.statusFilter;
        if (f === 'all') return true;
        if (f === 'pending') return z.status === 'pending' || z.status === 'upcoming';
        return z.status === f;
    }
    function chip(status) {
        const s = STATUS[status] || STATUS.none;
        return '<span class="chip ' + s.css + '">' + esc(s.label) + '</span>';
    }

    function render() {
        const d = state.data;
        if (!d) return;
        ['zones', 'routes', 'vehicles', 'feedback', 'points', 'emergencies'].forEach(function (k) { state.layers[k].clearLayers(); });

        d.zones.forEach(function (z) {
            if (!passes(z)) return;
            const color = zoneColor(z);
            const sel = state.selected === z.id;
            const click = function () { select(z.id, true); };
            if (z.boundary && z.boundary.length >= 3) {
                const provisional = /provisional/i.test(z.boundary_source || '');
                const poly = L.polygon(z.boundary, { color: color, weight: sel ? 4 : 2, fillColor: color,
                    fillOpacity: sel ? .35 : (z.mode === 'drop_off' ? .08 : .18), dashArray: provisional ? '6 4' : null });
                poly.on('click', click);
                poly.bindTooltip(esc(z.name), { permanent: true, direction: 'center', className: 'zone-label' });
                poly.addTo(state.layers.zones);
            }
            if (z.path && z.path.length) {
                if (z.path.length > 1) {
                    const casing = L.polyline(z.path, { color: '#ffffff', weight: sel ? 10 : 7, opacity: .9 });
                    const line = L.polyline(z.path, { color: color, weight: sel ? 6 : 4, opacity: .95 });
                    line.on('click', click); casing.on('click', click);
                    line.bindTooltip(esc(z.name) + ' route', { sticky: true });
                    casing.addTo(state.layers.routes); line.addTo(state.layers.routes);
                }
                const start = z.path[0];
                L.marker(start, {
                    icon: L.divIcon({ className: '', html: '<div class="zone-pin" style="background:' + color + '">' + esc(z.number != null ? z.number : '•') + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
                    title: z.name + ' route start', keyboard: true
                }).on('click', click).addTo(state.layers.routes);
            }
        });

        (d.points || []).forEach(function (p) {
            if (p.lat == null) return;
            const served = p.served.join(', ');
            const m = L.marker([p.lat, p.lng], {
                icon: L.divIcon({ className: '', html: '<div class="stop-pin' + (p.today ? ' today' : '') + (p.confirmed ? '' : ' unconfirmed') + '">' + truckSvg + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }),
                title: p.name, zIndexOffset: 500
            });
            const gmaps = p.maps_url || ('https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng);
            m.bindPopup('<strong>' + esc(p.name) + '</strong>' +
                esc(p.days.length ? p.days.map(function (x) { return x.slice(0, 3); }).join(', ') : 'No days set') + ' · ' + esc(p.window) +
                (p.standby ? '<br>Truck stands by ' + esc(p.standby) + ' min' : '') +
                '<br>Serves ' + esc(served || 'no zone') +
                (p.landmark ? '<br><small class="muted">' + esc(p.landmark) + '</small>' : '') +
                '<br><small class="muted">' + (p.confirmed ? 'Location confirmed by the barangay' : 'Location from a Google Maps reference; not yet confirmed on site') + '</small>' +
                '<br><a href="' + esc(gmaps) + '" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>', { maxWidth: 280, minWidth: 240, autoPanPaddingTopLeft: L.point(56, 16), autoPanPaddingBottomRight: L.point(16, 16) });
            m.addTo(state.layers.points);
        });

        (d.emergencies || []).forEach(function (e) {
            if (e.lat == null) return;
            const css = e.overdue ? 'overdue' : (e.status === 'Completed' ? 'done' : (e.status === 'Cancelled' ? 'cancelled' : ''));
            L.marker([e.lat, e.lng], {
                icon: L.divIcon({ className: '', html: '<div class="em-pin ' + css + '">!</div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
                title: 'Emergency collection', zIndexOffset: 900
            }).bindPopup('<strong>Emergency collection</strong>' + esc(e.status) + (e.overdue ? ' (overdue)' : '') + ' · ' + esc(e.window) +
                '<br>' + esc(e.location) + ' · ' + esc(e.zone) + '<br>' + esc(e.reason) +
                '<br><small class="muted">' + esc(e.collector) + (e.truck ? ' · ' + esc(e.truck) : '') + '</small>').addTo(state.layers.emergencies);
        });

        d.vehicles.forEach(function (v) {
            const g = GPS[v.gps] || GPS.stale;
            const m = L.marker([v.lat, v.lng], {
                icon: L.divIcon({ className: '', html: '<div class="veh-icon ' + esc(v.gps) + '">' + truckSvg + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }),
                title: v.name, zIndexOffset: 1000, opacity: v.gps === 'stale' ? .7 : 1
            });
            m.bindPopup('<strong>' + esc(v.name) + '</strong>' +
                (v.truck ? 'Truck ' + esc(v.truck) + '<br>' : 'No truck assigned<br>') +
                esc(v.zone) + '<br>' + esc(v.duty_text) + '<br>' +
                '<span class="chip ' + (v.gps === 'live' ? 'ongoing' : (v.gps === 'recent' ? 'pending' : '')) + '">' + esc(g.label) + ' · ' + esc(v.ago) + '</span>' +
                '<br><small class="muted">' + esc(g.note) + '</small>');
            m.addTo(state.layers.vehicles);
        });

        d.feedback.forEach(function (f) {
            L.marker([f.lat, f.lng], {
                icon: L.divIcon({ className: '', html: '<div class="fb-pin" style="background:' + (f.status === 'In Progress' ? '#a8670e' : '#c2412d') + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
                title: f.type
            }).bindPopup('<strong>' + esc(f.type) + '</strong>' + esc(f.status) + ' · ' + esc(f.zone) +
                (f.description ? '<br>' + esc(f.description.slice(0, 160)) : '') +
                (f.created_at ? '<br><small class="muted">Reported ' + esc(f.created_at) + '</small>' : '')
            ).addTo(state.layers.feedback);
        });

        renderList();
        renderLegend();
        if (state.selected != null) renderInfo();
    }

    function renderList() {
        const ul = side.querySelector('#zoneList');
        const d = state.data;
        ul.innerHTML = d.zones.map(function (z) {
            if (!passes(z)) return '';
            const s = STATUS[z.status] || STATUS.none;
            const onMap = true;
            return '<li><button type="button" data-zone="' + z.id + '" aria-pressed="' + (state.selected === z.id) + '">' +
                '<span class="zone-badge" style="background:' + z.color + '">' + esc(z.number != null ? z.number : '?') + '</span>' +
                '<span style="flex:1;min-width:0"><strong style="display:block">' + esc(z.name) + '</strong>' +
                '<span class="muted" style="font-size:.75rem">' + (z.mode === 'drop_off' ? 'Drop-off area, no truck stop' : esc((z.days.length ? z.days.map(function (x) { return x.slice(0, 2); }).join('/') + ' ' : '') + z.window)) + '</span></span>' +
                '<span class="chip ' + s.css + '">' + esc(s.label) + '</span></button></li>';
        }).join('') || '<li class="empty"><strong>No zones match</strong><span>Change the "Show zones" filter.</span></li>';
        ul.querySelectorAll('[data-zone]').forEach(function (b) {
            b.addEventListener('click', function () { select(Number(b.dataset.zone), true); });
        });
    }

    function renderLegend() {
        const d = state.data;
        const drawnZones = d.zones.filter(function (z) { return z.boundary && z.boundary.length >= 3; }).length;
        const routes = d.zones.filter(function (z) { return z.path && z.path.length > 1; }).length;
        const live = d.vehicles.filter(function (v) { return v.gps === 'live'; }).length;
        let html = '';
        if (state.colorBy === 'status') {
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
                ['completed', 'ongoing', 'pending', 'delayed', 'none'].map(chip).join('') + '</div>';
        }
        const provisional = d.zones.filter(function (z) { return /provisional/i.test(z.boundary_source || ''); }).length;
        const stops = (d.points || []).filter(function (p) { return p.today; }).length;
        html += drawnZones
            ? '<strong>' + drawnZones + '</strong> zone areas shown' + (provisional ? ' (dashed = traced from the barangay zone map, not yet confirmed)' : '') + '. '
            : 'Zone areas are not drawn yet: no zone map has been loaded. ';
        html += '<strong>' + stops + '</strong> truck stop(s) on ' + esc(d.day || 'this day') + '. ';
        if ((d.emergencies || []).length) html += '<strong>' + d.emergencies.length + '</strong> emergency collection(s). ';
        if (routes) html += '<strong>' + routes + '</strong> zone route(s) saved. ';
        html += '<strong>' + d.vehicles.length + '</strong> collector position(s), ' + live + ' live.';
        side.querySelector('#mapLegend').innerHTML = html;
    }

    function select(id, fly) {
        state.selected = state.selected === id && !fly ? null : id;
        render();
        const z = state.data.zones.find(function (x) { return x.id === id; });
        if (z && fly) {
            const pts = (z.boundary && z.boundary.length >= 3 ? z.boundary : []).concat(z.path || []);
            if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 18 });
        }
        if (typeof opts.onZoneSelect === 'function') opts.onZoneSelect(z);
    }

    function stopsFor(z) {
        return (state.data.points || []).filter(function (p) { return p.served_ids.indexOf(z.id) > -1; })
            .map(function (p) { return p.name + ' (' + p.days.map(function (x) { return x.slice(0, 3); }).join('/') + ' ' + p.window + ')'; });
    }

    function renderInfo() {
        const box = side.querySelector('#zoneInfo');
        const z = state.data.zones.find(function (x) { return x.id === state.selected; });
        if (!z) { box.hidden = true; return; }
        box.hidden = false;
        const items = z.items.length
            ? '<ul class="list" style="margin:10px -16px 0">' + z.items.map(function (it) {
                const s = STATUS[it.state] || STATUS.none;
                return '<li><span class="grow"><span class="title">' + esc(it.category) + ' · ' + esc(it.window) + '</span>' +
                    '<span class="meta">' + esc(it.collector) + (it.truck ? ' · ' + esc(it.truck) : '') + (it.late ? ' · completed late' : '') + '</span></span>' +
                    '<span class="chip ' + s.css + '">' + esc(s.label) + '</span></li>';
            }).join('') + '</ul>'
            : '<p class="note" style="margin-top:10px">' + (z.mode === 'drop_off' ? 'Drop-off zone: no truck pickups are scheduled.' : 'No collection scheduled for ' + esc(state.data.date) + '.') + '</p>';
        box.innerHTML =
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:start">' +
            '<h3>' + esc(z.name) + '</h3><button type="button" class="btn btn-ghost btn-sm" id="zoneInfoClose">Close</button></div>' +
            chip(z.status) +
            '<dl><dt>Collection days</dt><dd>' + esc(z.days.length ? z.days.join(', ') : 'Not set') + '</dd>' +
            '<dt>Time window</dt><dd>' + esc(z.window) + '</dd>' +
            '<dt>Collectors</dt><dd>' + esc(z.collectors.length ? z.collectors.join(', ') : 'None assigned') + '</dd>' +
            (z.mode === 'drop_off' ? '<dt>Collection</dt><dd>Residents bring garbage to the designated place; no truck stop</dd>' : '') +
            '<dt>Truck stops</dt><dd>' + esc(stopsFor(z).join('; ') || 'None') + '</dd>' +
            '<dt>Zone area</dt><dd>' + (z.boundary && z.boundary.length >= 3 ? esc(z.boundary_source || 'Saved') : 'Not drawn yet') + '</dd></dl>' +
            '<p class="note" style="margin-top:12px"><strong>' + esc(state.data.date === state.data.today ? 'Today' : state.data.date) + '</strong></p>' + items;
        box.querySelector('#zoneInfoClose').addEventListener('click', function () { state.selected = null; box.hidden = true; render(); });
    }

    /* ---------- Data ---------- */
    const poller = poll(function () { return opts.load(state.date); }, opts.pollMs || 15000, function (data) {
        if (!alive) return;
        state.data = data;
        if (dateInput && !dateInput.value) dateInput.value = data.date;
        // First load: frame the map on the zones once they are known.
        if (!state.fitted) {
            const pts = [];
            data.zones.forEach(function (z) { (z.boundary || []).forEach(function (p) { pts.push(p); }); });
            if (pts.length) { map.fitBounds(L.latLngBounds(pts), { padding: [12, 12], animate: false }); state.fitted = true; }
        }
        render();
    }, opts.onStatus);

    // Leaflet needs a size recalculation when its container changes (sidebar, resize).
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(function () { map.invalidateSize(); });
        ro.observe(opts.canvas);
        cleanup.push(function () { ro.disconnect(); });
    }

    return {
        map: map,
        refresh: poller.refresh,
        select: function (id) { select(id, true); },
        destroy: function () { alive = false; poller.stop(); cleanup.forEach(function (f) { f(); }); map.remove(); }
    };
}
