import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../AuthContext';
import { countRows, list } from '../../data/admin';
import { BarChart, DoughnutChart } from '../charts';
import { DAYS_MON_FIRST, FONT_STACK, Grid, Split, cardStyle, groupCount, safe } from '../dash';
import { Icon, P } from '../icons';
import { Loading } from '../ui';
import { useLoad } from '../useLoad';

// Look & feel of users/lgu_admin/dashboard.php
const SHADOW = '0 5px 20px rgba(15, 23, 42, 0.035)';
const TONE = { green: ['#eaf7ef', '#19924a'], blue: ['#eaf2ff', '#3478db'], amber: ['#fff5df', '#c27a09'], purple: ['#f1edff', '#7357c7'] };

function StatCard({ tone, icon, label, value, small, highlight }) {
  return (
    <View style={[cardStyle(13, highlight ? '#cfe8d7' : '#e6eaf0', SHADOW), { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 84, padding: 15, backgroundColor: highlight ? '#fbfefc' : '#fff' }]}>
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: TONE[tone][0], alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={icon} size={20} color={TONE[tone][1]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#1f2937', fontSize: 23, lineHeight: 25, fontWeight: '700' }}>{Number(value ?? 0).toLocaleString('en-US')}</Text>
        <Text style={{ marginTop: 4, color: '#7d8796', fontSize: 11 }}>{label}</Text>
        {small ? <Text style={{ marginTop: 2, color: '#19924a', fontSize: 10, fontWeight: '600' }}>{small}</Text> : null}
      </View>
    </View>
  );
}

function Card({ eyebrow, title, right, children }) {
  return (
    <View style={cardStyle(14, '#e6eaf0', SHADOW)}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 15, paddingTop: 19, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 5, color: '#8b95a5', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{eyebrow}</Text>
          <Text style={{ color: '#293241', fontSize: 15, fontWeight: '700' }}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const ViewAll = ({ onPress }) => (
  <Pressable onPress={onPress}><Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>View all →</Text></Pressable>
);

function Empty({ title, text }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 160, padding: 20 }}>
      <View style={{ width: 38, height: 38, marginBottom: 9, borderRadius: 10, backgroundColor: '#f3f5f7', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9aa3b1', fontSize: 18 }}>—</Text>
      </View>
      <Text style={{ color: '#4b5563', fontSize: 12, fontWeight: '700' }}>{title}</Text>
      <Text style={{ maxWidth: 260, marginTop: 4, color: '#9aa3b1', fontSize: 10, lineHeight: 15, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '');

export default function LguDashboard({ go }) {
  const { name } = useAuth();

  const { data, error, loading, reload } = useLoad(async () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const [admins, collectors, trucks, routes, residents, schedules, reports, categories, todayCount] = await Promise.all([
      safe(countRows('barangay_admin'), 0), safe(countRows('garbage_collector'), 0), safe(countRows('truck'), 0),
      safe(countRows('route'), 0), safe(countRows('resident'), 0), safe(countRows('collection_schedule'), 0),
      safe(countRows('feedback_report'), 0), safe(countRows('waste_category'), 0),
      safe(countRows('collection_schedule', (q) => q.eq('day_of_week', today)), 0),
    ]);
    const [scheduleRows, categoryRows, feedbackRows, residentRows, announcementRows] = await Promise.all([
      safe(list('collection_schedule'), []),
      safe(list('waste_category'), []),
      safe(list('feedback_report', 'created_at', false), []),
      safe(list('resident'), []),
      safe(list('announcement', 'published_timestamp', false), []),
    ]);
    return { today, stats: { admins, collectors, trucks, routes, residents, schedules, reports, categories, todayCount }, scheduleRows, categoryRows, feedbackRows, residentRows, announcementRows };
  }, []);

  if (loading || error) return <Loading error={error} onRetry={reload} />;

  const { today, stats, scheduleRows, categoryRows, feedbackRows, residentRows, announcementRows } = data;
  const catName = Object.fromEntries(categoryRows.map((c) => [c.waste_category_id, c.category_name]));
  const resName = Object.fromEntries(residentRows.map((r) => [r.resident_id, `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()]));

  const weekly = DAYS_MON_FIRST.map((d) => scheduleRows.filter((s) => (s.day_of_week ?? '').trim() === d).length);
  const status = groupCount(scheduleRows, (s) => s.schedule_status || 'Unknown');
  const cat = groupCount(scheduleRows, (s) => catName[s.waste_category_id] ?? 'Uncategorized');
  const reportTypes = groupCount(feedbackRows, (f) => f.report_type || 'Other');
  const recentFeedback = feedbackRows.slice(0, 6);
  const recentNews = announcementRows.slice(0, 6);

  const statCols = (w) => (w <= 480 ? 1 : w <= 700 ? 2 : w <= 1200 ? 3 : 4);
  const overviewCols = (w) => (w <= 480 ? 1 : w <= 700 ? 2 : w <= 1200 ? 3 : 6);
  const overview = [
    ['Barangay Administrators', stats.admins], ['Garbage Collectors', stats.collectors], ['Fleet Trucks', stats.trucks],
    ['Collection Routes', stats.routes], ['Waste Categories', stats.categories], ['Registered Residents', stats.residents],
  ];

  return (
    <View style={{ width: '100%', fontFamily: FONT_STACK }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ marginBottom: 5, color: '#8b95a5', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>LGU ADMINISTRATION</Text>
        <Text style={{ marginBottom: 6, color: '#000', fontSize: 28, fontWeight: '700' }}>Welcome back{name ? `, ${name}` : ''}</Text>
        <Text style={{ color: '#7b8494', fontSize: 14 }}>System-wide overview of the barangay waste collection network.</Text>
      </View>

      <Grid cols={statCols} gap={14} style={{ marginBottom: 20 }}>
        <StatCard tone="green" icon={P.users} label="Barangay Admins" value={stats.admins} />
        <StatCard tone="blue" icon={P.collector} label="Garbage Collectors" value={stats.collectors} />
        <StatCard tone="amber" icon={P.truck} label="Fleet Trucks" value={stats.trucks} />
        <StatCard tone="purple" icon={P.road} label="Total Routes" value={stats.routes} />
        <StatCard tone="green" icon={P.resident} label="Residents" value={stats.residents} />
        <StatCard tone="blue" icon={P.calendar} label="Collection Schedules" value={stats.schedules} />
        <StatCard tone="amber" icon={P.feedback} label="Resident Reports" value={stats.reports} />
        <StatCard tone="green" icon={P.bubble} label="Scheduled Today" value={stats.todayCount} small={today} highlight />
      </Grid>

      <Split ratios={[1.6, 1]} gap={16} stackBelow={900} style={{ marginBottom: 16 }}>
        <Card eyebrow="COLLECTION ACTIVITY" title="Weekly Collection Schedule" right={<Text style={{ color: '#9aa3b1', fontSize: 10 }}>{stats.schedules.toLocaleString('en-US')} total schedules</Text>}>
          <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 18 }}><BarChart labels={DAYS_MON_FIRST} values={weekly} height={252} /></View>
        </Card>
        <Card eyebrow="SCHEDULE STATUS" title="Current Status">
          <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 18, minHeight: 280, justifyContent: 'center' }}>
            {status.length === 0
              ? <Empty title="No schedules yet" text="Schedule status will appear here." />
              : <DoughnutChart labels={status.map((s) => s[0])} values={status.map((s) => s[1])} cutout={0.72} size={200} />}
          </View>
        </Card>
      </Split>

      <Split ratios={[1.6, 1]} gap={16} stackBelow={900} style={{ marginBottom: 16 }}>
        <Card eyebrow="WASTE MANAGEMENT" title="Waste Category Distribution">
          <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 18 }}>
            {cat.length === 0
              ? <Empty title="No schedules yet" text="Waste category data will appear here." />
              : <BarChart horizontal labels={cat.map((c) => c[0])} values={cat.map((c) => c[1])} height={252} />}
          </View>
        </Card>
        <Card eyebrow="RESIDENT FEEDBACK" title="Report Types" right={<ViewAll onPress={() => go('reports')} />}>
          {reportTypes.length === 0 ? (
            <Empty title="No resident feedback yet" text="Feedback submitted by residents will appear here." />
          ) : (
            <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 18, minHeight: 280, justifyContent: 'center' }}>
              <DoughnutChart labels={reportTypes.map((r) => r[0])} values={reportTypes.map((r) => r[1])} cutout={0.68} size={200} />
            </View>
          )}
        </Card>
      </Split>

      <Grid cols={(w) => (w <= 900 ? 1 : 2)} gap={16} style={{ marginBottom: 16 }}>
        <Card eyebrow="COMMUNITY" title="Recent Resident Reports" right={<ViewAll onPress={() => go('reports')} />}>
          {recentFeedback.length === 0 ? (
            <Empty title="No resident reports yet" text="Reports submitted by residents will appear here." />
          ) : (
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              {recentFeedback.map((f, i) => (
                <View key={f.feedback_report_id ?? i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f0f2f5' }}>
                  <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon d={P.feedback} size={16} color="#64748b" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>{f.report_type ?? 'Report'}</Text>
                    <Text style={{ marginTop: 3, color: '#969fac', fontSize: 11 }}>{resName[f.resident_id] || 'Unknown resident'}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
        <Card eyebrow="COMMUNICATION" title="Recent Announcements" right={<ViewAll onPress={() => go('news')} />}>
          {recentNews.length === 0 ? (
            <Empty title="No announcements yet" text="Announcements you publish will appear here." />
          ) : (
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              {recentNews.map((a, i) => (
                <View key={a.announcement_id ?? i} style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f0f2f5' }}>
                  <Text numberOfLines={1} style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>{a.title}</Text>
                  <Text style={{ marginTop: 4, color: '#969fac', fontSize: 10 }}>{fmtDate(a.published_timestamp)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Grid>

      <View style={{ marginBottom: 20 }}>
        <Card eyebrow="SYSTEM OVERVIEW" title="Waste Collection Network">
          <Grid cols={overviewCols} gap={0} style={{ paddingTop: 5, paddingHorizontal: 20, paddingBottom: 20 }}>
            {overview.map(([label, value], i) => (
              <View key={label} style={{ paddingVertical: 13, paddingHorizontal: 15, borderRightWidth: i === overview.length - 1 ? 0 : 1, borderRightColor: '#edf0f3' }}>
                <Text style={{ marginBottom: 7, color: '#969fac', fontSize: 10 }}>{label}</Text>
                <Text style={{ color: '#293241', fontSize: 19, fontWeight: '700' }}>{Number(value).toLocaleString('en-US')}</Text>
              </View>
            ))}
          </Grid>
        </Card>
      </View>
    </View>
  );
}
