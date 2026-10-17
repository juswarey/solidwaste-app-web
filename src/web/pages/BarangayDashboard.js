import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../AuthContext';
import { list } from '../../data/admin';
import { BarChart, DoughnutChart } from '../charts';
import { DAYS_MON_FIRST, EmptyBox, FONT_STACK, Grid, HoverCard, cardStyle, groupCount, safe, useClock } from '../dash';
import { Icon, P } from '../icons';
import { Loading } from '../ui';
import LeafletMap from '../LeafletMap';
import { useLoad } from '../useLoad';

// Look & feel of users/barangay_admin/dashboard.php
const SHADOW = '0 4px 18px rgba(20, 30, 50, 0.045)';
const SHADOW_HOVER = '0 9px 28px rgba(20, 30, 50, 0.075)';
const STAT = { green: ['#eaf8f0', '#22a06b'], blue: ['#edf4ff', '#377dff'], purple: ['#f3edff', '#8254d8'], amber: ['#fff6df', '#d89b16'] };
const POBLACION = { latitude: 8.2291757, longitude: 124.2379914 };

function StatCard({ tone, icon, label, value, note }) {
  return (
    <HoverCard style={[cardStyle(16, '#e9edf2', SHADOW), { flexDirection: 'row', alignItems: 'flex-start', minHeight: 125, padding: 20, gap: 14 }]} hoverShadow="0 8px 24px rgba(20, 30, 50, 0.08)">
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: STAT[tone][0], alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={icon} size={22} color={STAT[tone][1]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ marginBottom: 4, color: '#7b8494', fontSize: 12, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: '#17202a', fontSize: 28, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7 }}>{Number(value ?? 0).toLocaleString('en-US')}</Text>
        <Text style={{ marginTop: 7, color: '#a0a8b5', fontSize: 11 }}>{note}</Text>
      </View>
    </HoverCard>
  );
}

function Badge({ children }) {
  return (
    <View style={{ paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: '#edf0f3', borderRadius: 7, backgroundColor: '#f8f9fb' }}>
      <Text style={{ color: '#7d8795', fontSize: 10, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

function ChartCard({ title, badge, sub, children, minHeight = 420 }) {
  return (
    <HoverCard style={[cardStyle(17, '#e8ecf1', SHADOW), { minHeight }]} hoverShadow={SHADOW_HOVER}>
      <View style={{ paddingTop: 21, paddingHorizontal: 23, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Text style={{ color: '#17202a', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>{title}</Text>
          {badge ? <Badge>{badge}</Badge> : null}
        </View>
        <Text style={{ marginTop: 5, color: '#929ba8', fontSize: 12, lineHeight: 18 }}>{sub}</Text>
      </View>
      {children}
    </HoverCard>
  );
}

function ListPanel({ title, sub, onViewAll, empty, children }) {
  return (
    <View style={cardStyle(17, '#e8ecf1', SHADOW)}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 15, paddingTop: 21, paddingHorizontal: 23, paddingBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#17202a', fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <Text style={{ marginTop: 5, color: '#929ba8', fontSize: 12 }}>{sub}</Text>
        </View>
        <Pressable onPress={onViewAll} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: hovered ? 0.8 : 1 })}>
          <Text style={{ color: '#3d78d8', fontSize: 11, fontWeight: '600' }}>View all</Text>
          <Text style={{ color: '#3d78d8', fontSize: 15 }}>→</Text>
        </Pressable>
      </View>
      {empty ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 130, padding: 20, paddingHorizontal: 23, borderTopWidth: 1, borderTopColor: '#f0f2f5' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f2f4f7', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#9aa3af', fontSize: 18 }}>+</Text>
          </View>
          <View>
            <Text style={{ color: '#5c6673', fontSize: 12, fontWeight: '700' }}>{empty[0]}</Text>
            <Text style={{ marginTop: 3, color: '#9aa3af', fontSize: 10 }}>{empty[1]}</Text>
          </View>
        </View>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: '#f0f2f5' }}>{children}</View>
      )}
    </View>
  );
}

function ListItem({ last, left, title, meta, chip, chipBg, chipColor }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 9, paddingHorizontal: 23, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#f0f2f5' }}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: '#3b4654', fontSize: 12, fontWeight: '600' }}>{title}</Text>
        <Text style={{ marginTop: 3, color: '#9aa3af', fontSize: 10 }}>{meta}</Text>
      </View>
      <View style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: 7, backgroundColor: chipBg }}>
        <Text style={{ color: chipColor, fontSize: 10, fontWeight: '600' }}>{chip}</Text>
      </View>
    </View>
  );
}

export default function BarangayDashboard({ go }) {
  const { profileId, name } = useAuth();
  const { weekday } = useClock();

  const { data, error, loading, reload } = useLoad(async () => {
    const [routes, schedules, collectors, categories] = await Promise.all([
      safe(list('route'), []),
      safe(list('collection_schedule', 'collection_schedule_id', false), []),
      safe(list('garbage_collector'), []),
      safe(list('waste_category'), []),
    ]);
    const myRoutes = routes.filter((r) => r.barangay_admin_id === profileId);
    const routeIds = new Set(myRoutes.map((r) => r.route_id));
    const mySchedules = schedules.filter((s) => s.barangay_admin_id === profileId);
    const myCollectors = collectors.filter((c) => routeIds.has(c.route_id));
    const catName = Object.fromEntries(categories.map((c) => [c.waste_category_id, c.category_name]));
    return { myRoutes, mySchedules, myCollectors, categories, catName };
  }, [profileId]);

  if (loading || error) return <Loading error={error} onRetry={reload} />;

  const { myRoutes, mySchedules, myCollectors, categories, catName } = data;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayCount = mySchedules.filter((s) => (s.day_of_week ?? '').trim() === today).length;

  const status = groupCount(mySchedules, (s) => s.schedule_status || 'Unknown');
  const dayValues = DAYS_MON_FIRST.map((d) => mySchedules.filter((s) => (s.day_of_week ?? '').trim() === d).length);
  const cat = groupCount(mySchedules, (s) => catName[s.waste_category_id] ?? 'Uncategorized');
  const perRoute = [...myRoutes].sort((a, b) => a.route_id - b.route_id).map((r) => [`Route #${r.route_id}`, myCollectors.filter((c) => c.route_id === r.route_id).length]);
  const recentSchedules = mySchedules.slice(0, 5);
  const recentCollectors = myCollectors.slice(0, 5);

  const statCols = (w) => (w <= 600 ? 1 : w <= 900 ? 2 : null);
  const chartCols = (w) => (w <= 1100 ? 1 : 2);

  return (
    <View style={{ width: '100%', fontFamily: FONT_STACK }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ marginBottom: 6, fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: '#8b95a5' }}>Barangay Administration</Text>
        <Text style={{ marginBottom: 4, fontSize: 25.6, fontWeight: '700', color: '#333', lineHeight: 32 }}>Welcome back{name ? `, ${name}` : ''}</Text>
        <Text style={{ fontSize: 15.2, color: '#666' }}>Monitor collection schedules, routes, and garbage collector assignments.</Text>
      </View>

      <Grid cols={statCols} min={230} gap={16} style={{ marginBottom: 22 }}>
        <StatCard tone="green" icon={P.routes} label="My Routes" value={myRoutes.length} note="Active routes assigned" />
        <StatCard tone="blue" icon={P.calendar} label="Collection Schedules" value={mySchedules.length} note="Total schedules" />
        <StatCard tone="purple" icon={P.person} label="Garbage Collectors" value={myCollectors.length} note="Assigned to my routes" />
        <StatCard tone="amber" icon={P.waste} label="Waste Categories" value={categories.length} note="Available categories" />
        <StatCard tone="green" icon={P.bubble} label="Scheduled Today" value={todayCount} note={`${today || weekday} collections`} />
      </Grid>

      <Grid cols={chartCols} gap={18} style={{ marginBottom: 18 }}>
        <ChartCard title="Collection Schedule Status" badge="Overview" sub="Current status of your collection schedules.">
          {status.length === 0 ? (
            <EmptyBox title="No schedule data" text="Schedule information will appear here." />
          ) : (
            <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', paddingTop: 8, paddingHorizontal: 20, paddingBottom: 18 }}>
              <DoughnutChart labels={status.map((s) => s[0])} values={status.map((s) => s[1])} cutout={0.76} centerValue={mySchedules.length} centerLabel="Total schedules" />
            </View>
          )}
        </ChartCard>
        <ChartCard title="Collection Schedules" badge="Weekly" sub="Distribution of collection schedules by day.">
          <View style={{ paddingTop: 10, paddingHorizontal: 22, paddingBottom: 22 }}>
            <BarChart labels={DAYS_MON_FIRST} values={dayValues} height={293} />
          </View>
        </ChartCard>
      </Grid>

      <Grid cols={chartCols} gap={18} style={{ marginBottom: 18 }}>
        <ChartCard title="Waste Category Distribution" badge="Categories" sub="Collection schedules grouped by waste category.">
          {cat.length === 0 ? (
            <EmptyBox title="No category data" text="Waste category information will appear here." />
          ) : (
            <View style={{ paddingTop: 10, paddingHorizontal: 22, paddingBottom: 22 }}>
              <BarChart horizontal labels={cat.map((c) => c[0])} values={cat.map((c) => c[1])} height={293} />
            </View>
          )}
        </ChartCard>
        <ChartCard title="Collectors by Route" badge="Staffing" sub="Garbage collectors assigned to each route.">
          {perRoute.length === 0 ? (
            <EmptyBox title="No route data" text="Collector assignments will appear here." />
          ) : (
            <View style={{ paddingTop: 10, paddingHorizontal: 22, paddingBottom: 22 }}>
              <BarChart labels={perRoute.map((r) => r[0])} values={perRoute.map((r) => r[1])} height={293} />
            </View>
          )}
        </ChartCard>
      </Grid>

      <View style={[cardStyle(17, '#e8ecf1', SHADOW), { marginBottom: 18 }]}>
        <View style={{ paddingTop: 21, paddingHorizontal: 23, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Text style={{ color: '#17202a', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>Barangay Map</Text>
            <Badge>Location Overview</Badge>
          </View>
          <Text style={{ marginTop: 5, color: '#929ba8', fontSize: 12, lineHeight: 18 }}>View the location of your barangay and collection-related locations.</Text>
        </View>
        <LeafletMap height={420} markers={[{ id: 'poblacion', ...POBLACION, label: 'Barangay Poblacion, Iligan City', color: '#d93025' }]} />
      </View>

      <Grid cols={(w) => (w <= 760 ? 1 : 2)} gap={18}>
        <ListPanel title="Recent Collection Schedules" sub="Latest schedules added to your barangay." onViewAll={() => go('schedules')} empty={recentSchedules.length ? null : ['No schedules yet', 'Add your first collection schedule.']}>
          {recentSchedules.map((s, i) => (
            <ListItem
              key={s.collection_schedule_id} last={i === recentSchedules.length - 1}
              left={<View style={{ width: 35, height: 35, borderRadius: 9, backgroundColor: '#f1f6ff', alignItems: 'center', justifyContent: 'center' }}><Icon d={P.calendar} size={18} color="#4c83dd" /></View>}
              title={catName[s.waste_category_id] ?? 'Waste'} meta={s.day_of_week} chip={s.schedule_status ?? 'Unknown'} chipBg="#f2f7f4" chipColor="#4b8b68"
            />
          ))}
        </ListPanel>
        <ListPanel title="Garbage Collectors" sub="Collectors assigned to your routes." onViewAll={() => go('collectors')} empty={recentCollectors.length ? null : ['No collectors assigned', 'Assigned collectors will appear here.']}>
          {recentCollectors.map((c, i) => (
            <ListItem
              key={c.garbage_collector_id} last={i === recentCollectors.length - 1}
              left={<View style={{ width: 35, height: 35, borderRadius: 18, backgroundColor: '#f0edff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#7658c9', fontSize: 12, fontWeight: '700' }}>{(c.first_name ?? '?').charAt(0).toUpperCase()}</Text></View>}
              title={`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()} meta={`Route #${c.route_id}`} chip="Assigned" chipBg="#edf8f2" chipColor="#3e8a61"
            />
          ))}
        </ListPanel>
      </Grid>
    </View>
  );
}
