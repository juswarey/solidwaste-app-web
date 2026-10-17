import React, { createElement, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { FONT, SITE_NAME, themes } from '../design';
import { Grid, HoverCard, Split, useClock } from '../dash';
import { Icon, P } from '../icons';
import AuthModal from './AuthModal';
import { logos } from './images';

/**
 * Public landing page — a port of the PHP site's index.php + header.php + footer.php (styles.css).
 * Shown on the website before anyone is signed in. The only behaviour it adds is opening the login
 * modal, which calls the existing signIn().
 */

const MAP_SRC = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d987.1840961705204!2d124.23391334638909!3d8.229242766848605!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x325575e7ac009721%3A0x5dd0875c959538f4!2sPoblacion%20Barangay%20Hall!5e0!3m2!1sen!2sph!4v1790219344394!5m2!1sen!2sph';

const txt = (t, extra) => ({ fontFamily: FONT, color: t.muted, fontSize: 16, lineHeight: 25.6, ...extra });
const h = (t, size, extra) => ({ fontFamily: FONT, color: t.text, fontWeight: '700', fontSize: size, lineHeight: size * 1.25, ...extra });

function Container({ children, style }) {
  return <View style={[{ width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 24 }, style]}>{children}</View>;
}

function Btn({ title, onPress, t, large, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [{
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', alignSelf: 'flex-start',
        paddingVertical: large ? 14.4 : 12, paddingHorizontal: large ? 35.2 : 28, borderRadius: large ? 12 : 6,
        backgroundColor: hovered ? t.primaryHover : t.primary, transform: [{ translateY: hovered ? -2 : 0 }],
      }, style]}
    >
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: large ? 17.6 : 16, fontFamily: FONT }}>{title}</Text>
    </Pressable>
  );
}

function SectionHeader({ t, title, text, titleColor, textColor }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 56 }}>
      <Text style={h(t, 36, { textAlign: 'center', color: titleColor ?? t.text })}>{title}</Text>
      {text ? <Text style={txt(t, { textAlign: 'center', marginTop: 16, maxWidth: 720, color: textColor ?? t.muted })}>{text}</Text> : null}
    </View>
  );
}

const iconBox = (t) => ({ width: 60, height: 60, borderRadius: 12, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 24 });
const cardBase = (t, extra) => ({ backgroundColor: t.bgSurface, borderRadius: 12, borderWidth: 1, borderColor: t.border, boxShadow: t.shadowSoft, ...extra });

function Hero({ t, narrow, onStart }) {
  return (
    <View nativeID="home" style={{ paddingVertical: 96, backgroundColor: t.primaryLight, backgroundImage: `linear-gradient(135deg, ${t.primaryLight} 0%, ${t.bgBody} 100%)` }}>
      <Container>
        <Split ratios={[1, 1]} gap={48} stackBelow={860} style={{ alignItems: 'center' }}>
          <View>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(46, 125, 50, 0.15)', paddingVertical: 6.4, paddingHorizontal: 16, borderRadius: 50, marginBottom: 16 }}>
              <Text style={{ color: t.primary, fontWeight: '700', fontSize: 13.6, fontFamily: FONT }}>Eco-Friendly & Intelligent</Text>
            </View>
            <Text style={h(t, narrow ? 38 : 52, { marginBottom: 20 })}>Solid Waste Collection Scheduling</Text>
            <Text style={txt(t, { fontSize: 18.4, lineHeight: 29.4, marginBottom: 32 })}>
              Streamlining city waste pickup and recycling for healthier communities. Schedule pickups on demand, monitor real-time routes, and keep your neighborhood green.
            </Text>
            <Btn title="Get Started" t={t} large onPress={onStart} />
          </View>
          <View style={{ backgroundColor: t.glassBg, borderWidth: 1, borderColor: t.glassBorder, borderRadius: 20, padding: 32, boxShadow: t.shadowSoft, backdropFilter: 'blur(12px)' }}>
            <svg viewBox="0 0 500 400" width="100%" style={{ display: 'block', maxHeight: 400 }}>
              <defs>
                <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2E7D32" stopOpacity="1" />
                  <stop offset="100%" stopColor="#1976D2" stopOpacity="1" />
                </linearGradient>
              </defs>
              <circle cx="250" cy="200" r="160" fill="url(#heroGrad)" opacity="0.15" />
              <rect x="120" y="140" width="260" height="180" rx="16" fill="#FFFFFF" />
              <rect x="140" y="160" width="220" height="20" rx="6" fill="#E8F5E9" />
              <rect x="140" y="195" width="160" height="14" rx="4" fill="#E0E0E0" />
              <rect x="140" y="220" width="180" height="14" rx="4" fill="#E0E0E0" />
              <circle cx="330" cy="265" r="30" fill="#2E7D32" />
              <path d="M320 265 l8 8 l16 -16" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </View>
        </Split>
      </Container>
    </View>
  );
}

const ABOUT = [
  { icon: P.home, title: 'For Residents', text: 'Never miss a pickup day again. Track trucks live in your neighborhood, log bulky item requests, and view recycling guidelines.' },
  { icon: P.aboutTruck, title: 'For Waste Collectors', text: 'Dynamic route optimization reduces fuel consumption and minimizes delays, improving overall team efficiency and safety.' },
  { icon: P.shield, title: 'Environmental Impact', text: 'Structured scheduled collection prevents landfill overflow, mitigates illegal dumping, and encourages active urban sorting.' },
];
const FEATURES = [
  ['📅', 'Online Scheduling', 'Book special bulk waste or hazardous material pickups directly from your smartphone or desktop.'],
  ['🗺️', 'Collection Calendar', 'Interactive calendar categorized by organic, recyclable, and general household waste types.'],
  ['📍', 'Real-Time Truck Tracking', 'Monitor live GPS locations of collection trucks in your zone so you know exactly when to place your bins out.'],
  ['🚚', 'Route Management', 'Optimized driver navigation pathways ensure timely servicing and reduced carbon emissions across municipal sectors.'],
  ['📊', 'Waste Reports', 'Access municipal data and personal household metrics to track monthly recycling efficiency over time.'],
  ['⚙️', 'Admin Dashboard', 'Centralized dispatch system for municipal managers to assign routes and handle citizen requests.'],
];
const STEPS = [
  ['👤', 'Register Account', 'Sign up with your residential address and contact information to assign your zone.'],
  ['📆', 'Schedule Pickup', 'Select your preferred dates or view fixed recurring collection windows.'],
  ['📍', 'Track Truck Live', 'Follow the collection truck’s arrival progress on an interactive live map in real time.'],
  ['♻️', 'Collection Done', 'Place bins out as the truck approaches. Our automated crew handles prompt, clean collection.'],
];

function FooterLink({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      {({ hovered }) => <Text style={{ color: hovered ? '#fff' : '#aaaaaa', fontFamily: FONT, fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}

export default function LandingPage() {
  const { width } = useWindowDimensions();
  const narrow = width <= 860;
  const [mode, setMode] = useState(() => {
    try { return window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const t = themes[mode];
  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try { window.localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
  };

  const scroller = useRef(null);
  const ys = useRef({});
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(false);
  const clock = useClock();

  useEffect(() => {
    if (typeof document !== 'undefined') document.body.style.backgroundColor = t.bgBody;
  }, [t.bgBody]);

  const goTo = (id) => {
    setMenu(false);
    if (id === 'home') return scroller.current?.scrollTo({ y: 0, animated: true });
    scroller.current?.scrollTo({ y: Math.max(0, (ys.current[id] ?? 0) - 80), animated: true });
  };
  const at = (id) => (e) => { ys.current[id] = e.nativeEvent.layout.y; };
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled(y > 10);
    setShowTop(y > 300);
  };
  const openLogin = () => { setMenu(false); setLogin(true); };

  const NAV = [['home', 'Home'], ['about', 'About'], ['services', 'Services'], ['contact', 'Contact']];

  const navLinks = NAV.map(([id, label], i) => (
    <Pressable key={id} onPress={() => goTo(id)} style={{ paddingVertical: narrow ? 10 : 0 }}>
      {({ hovered }) => <Text style={{ fontFamily: FONT, fontSize: 16, fontWeight: '500', color: hovered || i === 0 ? t.primary : t.text }}>{label}</Text>}
    </Pressable>
  ));

  const header = (
    <View style={{ backgroundColor: t.bgSurface, borderBottomWidth: 1, borderBottomColor: t.border, boxShadow: scrolled ? t.shadowSoft : 'none', zIndex: 1000 }}>
      <Container style={{ height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => goTo('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {logos.map((l) => <Image key={l.key} source={l.source} accessibilityLabel={l.alt} resizeMode="contain" style={{ width: 42, height: 42, borderRadius: 21 }} />)}
          </View>
          {width > 520 && (
            <View>
              <Text style={{ fontFamily: FONT, fontSize: 21.6, fontWeight: '800', color: t.primary, lineHeight: 21.6 }}>{SITE_NAME}</Text>
              <Text style={{ fontFamily: FONT, fontSize: 12, color: t.muted, marginTop: 3 }}>Barangay Poblacion Waste System</Text>
            </View>
          )}
        </Pressable>

        {!narrow && <View style={{ flexDirection: 'row', gap: 28 }}>{navLinks}</View>}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {width > 1000 && (
            <View style={{ alignItems: 'center', minWidth: 140 }}>
              <Text style={{ fontFamily: FONT, fontSize: 16, fontWeight: '700', color: t.secondary }}>{clock.time}</Text>
              <Text style={{ fontFamily: FONT, fontSize: 12.8, color: t.muted }}>{clock.date}</Text>
            </View>
          )}
          <Pressable onPress={toggleTheme} accessibilityLabel="Toggle Dark Mode" style={{ padding: 8, borderRadius: 20 }}>
            <Icon d={mode === 'dark' ? P.sun : P.moon} size={20} stroke color={t.text} />
          </Pressable>
          <Btn title="Login" t={t} onPress={openLogin} />
          {narrow && (
            <Pressable onPress={() => setMenu((m) => !m)} accessibilityLabel="Toggle Menu" style={{ gap: 5, padding: 4 }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ width: 25, height: 3, borderRadius: 3, backgroundColor: t.text }} />)}
            </Pressable>
          )}
        </View>
      </Container>
      {narrow && menu && <Container style={{ paddingBottom: 12 }}>{navLinks}</Container>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bgBody }}>
      <ScrollView ref={scroller} stickyHeaderIndices={[0]} onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator>
        {header}

        <Hero t={t} narrow={narrow} onStart={openLogin} />

        <View onLayout={at('about')} style={{ paddingVertical: 80, backgroundColor: t.bgBody }}>
          <Container>
            <SectionHeader t={t} title="Organized Collection For Better Living" text="We combine technology and operational logistics to minimize environmental impact and maximize recycling rates." />
            <Grid min={300} gap={32}>
              {ABOUT.map((a) => (
                <HoverCard key={a.title} lift={8} hoverShadow={t.shadowHover} style={cardBase(t, { padding: 32, paddingVertical: 40, height: '100%' })}>
                  <View style={iconBox(t)}><Icon d={a.icon} size={36} stroke color={t.primary} /></View>
                  <Text style={h(t, 24, { marginBottom: 8 })}>{a.title}</Text>
                  <Text style={txt(t)}>{a.text}</Text>
                </HoverCard>
              ))}
            </Grid>
          </Container>
        </View>

        <View onLayout={at('services')} style={{ paddingVertical: 80, backgroundColor: t.bgLight }}>
          <Container>
            <SectionHeader t={t} title="Smart Tools For Smarter Cities" />
            <Grid min={300} gap={32}>
              {FEATURES.map(([icon, title, text]) => (
                <HoverCard key={title} lift={8} hoverShadow={t.shadowHover} style={cardBase(t, { padding: 32, paddingVertical: 40, height: '100%' })}>
                  <View style={iconBox(t)}><Text style={{ fontSize: 28.8 }}>{icon}</Text></View>
                  <Text style={h(t, 24, { marginBottom: 8 })}>{title}</Text>
                  <Text style={txt(t)}>{text}</Text>
                </HoverCard>
              ))}
            </Grid>
          </Container>
        </View>

        <View style={{ paddingVertical: 80, backgroundColor: t.bgBody }}>
          <Container>
            <SectionHeader t={t} title="How It Works" />
            <Grid min={220} gap={32} style={{ paddingTop: 15 }}>
              {STEPS.map(([icon, title, text], i) => (
                <View key={title} style={[cardBase(t, { padding: 32, alignItems: 'center', height: '100%' }), { overflow: 'visible' }]}>
                  <View style={{ position: 'absolute', top: -15, alignSelf: 'center', width: 35, height: 35, borderRadius: 18, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontFamily: FONT }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontSize: 40, marginVertical: 16 }}>{icon}</Text>
                  <Text style={h(t, 24, { marginBottom: 8, textAlign: 'center' })}>{title}</Text>
                  <Text style={txt(t, { textAlign: 'center' })}>{text}</Text>
                </View>
              ))}
            </Grid>
          </Container>
        </View>

        <View style={{ paddingVertical: 80, backgroundColor: t.primary, backgroundImage: `linear-gradient(135deg, ${t.primary} 0%, ${t.secondary} 100%)` }}>
          <Container style={{ alignItems: 'center' }}>
            <Text style={h(t, 36, { color: '#fff', textAlign: 'center', marginBottom: 12 })}>Building a Cleaner Iligan City Together</Text>
            <Text style={txt(t, { color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 650 })}>
              Our digital waste scheduling system is officially live! As residents, barangay officials, and collection crews register across Iligan City, real-time statistics and analytics will populate here.
            </Text>
          </Container>
        </View>

        <View style={{ paddingVertical: 80, backgroundColor: t.bgBody }}>
          <Container>
            <SectionHeader t={t} title="What Our Residents Say" text="Community feedback and reviews will be featured here as Iligan residents use the system." />
            <View style={{ width: '100%', maxWidth: 700, alignSelf: 'center', alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32, borderWidth: 2, borderStyle: 'dashed', borderColor: t.border, borderRadius: 12, backgroundColor: t.bgSurface }}>
              <Text style={{ fontSize: 48, marginBottom: 16, opacity: 0.8 }}>💬</Text>
              <Text style={h(t, 24, { marginBottom: 8, textAlign: 'center' })}>Be One of Our First Reviewers</Text>
              <Text style={txt(t, { fontSize: 15.2, textAlign: 'center' })}>
                We are just getting started! Once collection services begin in your area, you'll be able to rate your service and share feedback to help us keep Iligan City clean and sustainable.
              </Text>
            </View>
          </Container>
        </View>

        <View onLayout={at('contact')} style={{ paddingVertical: 80, backgroundColor: '#f8faf9' }}>
          <Container>
            <View style={{ alignItems: 'center', marginBottom: 45 }}>
              <Text style={h(t, 36, { textAlign: 'center', marginBottom: 12, color: '#333' })}>Our Service Area</Text>
              <Text style={{ fontFamily: FONT, color: '#6b7280', lineHeight: 27, fontSize: 16, textAlign: 'center', maxWidth: 720 }}>
                Find us in Barangay Poblacion, Iligan City and get in touch with our support team for questions about waste collection services.
              </Text>
            </View>
            <Split ratios={[1.5, 1]} gap={30} stackBelow={860} style={{ alignItems: 'stretch' }}>
              <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', minHeight: 450, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', boxShadow: '0 12px 35px rgba(0, 0, 0, 0.08)' }}>
                {createElement('iframe', { src: MAP_SRC, title: 'Poblacion Barangay Hall map', loading: 'lazy', allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin', style: { display: 'block', width: '100%', height: '100%', minHeight: 450, border: 0 } })}
              </View>
              <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 40, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', boxShadow: '0 12px 35px rgba(0, 0, 0, 0.08)' }}>
                <Text style={{ fontFamily: FONT, color: '#2e7d32', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 12 }}>GET IN TOUCH</Text>
                <Text style={{ fontFamily: FONT, fontSize: 32, fontWeight: '700', color: '#1f2937', marginBottom: 15 }}>Need Help?</Text>
                <Text style={{ fontFamily: FONT, color: '#6b7280', lineHeight: 27, marginBottom: 30, fontSize: 16 }}>
                  Have questions about waste collection schedules, reports, or other services? Our team is here to help.
                </Text>
                <View style={{ gap: 22, marginBottom: 30 }}>
                  {[['📍', 'Location', 'Barangay Poblacion\nIligan City, Philippines'], ['📧', 'Email', 'support@solidwaste.local'], ['📞', 'Contact', 'Contact your Barangay Office']].map(([ic, label, value]) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 15 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 19 }}>{ic}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: FONT, fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 4 }}>{label}</Text>
                        <Text style={{ fontFamily: FONT, color: '#4b5563', lineHeight: 24, fontSize: 16 }}>{value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Btn title="Get Started" t={t} onPress={openLogin} />
              </View>
            </Split>
          </Container>
        </View>

        <View style={{ backgroundColor: '#1a1a1a', paddingTop: 64 }}>
          <Container>
            <Split ratios={[2, 1, 1, 1.5]} gap={48} stackBelow={860} style={{ marginBottom: 48 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <Icon d={P.logo} size={28} stroke color="#fff" />
                  <Text style={{ fontFamily: FONT, fontSize: 21.6, fontWeight: '800', color: '#fff' }}>{SITE_NAME}</Text>
                </View>
                <Text style={{ fontFamily: FONT, color: '#aaaaaa', lineHeight: 25.6, marginBottom: 24, fontSize: 16 }}>
                  Providing sustainable waste management logistics and modern scheduling solutions to build cleaner, smarter communities.
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {['FB', 'TW', 'IG', 'LN'].map((s) => (
                    <Pressable key={s} style={({ hovered }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: hovered ? '#2e7d32' : '#333', alignItems: 'center', justifyContent: 'center' })}>
                      <Text style={{ color: '#fff', fontSize: 13.6, fontWeight: '700', fontFamily: FONT }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View>
                <Text style={h(t, 16, { color: '#fff', marginBottom: 20 })}>Quick Links</Text>
                <FooterLink label="Home" onPress={() => goTo('home')} />
                <FooterLink label="About Us" onPress={() => goTo('about')} />
                <FooterLink label="Services" onPress={() => goTo('services')} />
                <FooterLink label="Contact" onPress={() => goTo('contact')} />
              </View>
              <View>
                <Text style={h(t, 16, { color: '#fff', marginBottom: 20 })}>Services</Text>
                {['Residential Pickup', 'Commercial Waste', 'Bulk Removal', 'E-Waste Recycling', 'Hazardous Disposal'].map((s) => <FooterLink key={s} label={s} />)}
              </View>
              <View>
                <Text style={h(t, 16, { color: '#fff', marginBottom: 20 })}>Contact Us</Text>
                {['📍 Poblacion, Iligan City', '📞 09358158491', '✉️ juswarey@gmail.com', '⏰ Mon - Fri: 8:00 AM - 5:00 PM'].map((c) => (
                  <Text key={c} style={{ fontFamily: FONT, color: '#aaaaaa', marginBottom: 8, fontSize: 16 }}>{c}</Text>
                ))}
              </View>
            </Split>
          </Container>
          <View style={{ borderTopWidth: 1, borderTopColor: '#333', paddingVertical: 24 }}>
            <Text style={{ fontFamily: FONT, textAlign: 'center', color: '#777', fontSize: 14.4 }}>
              © {new Date().getFullYear()} {SITE_NAME} Iligan City Waste System. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>

      {showTop && (
        <Pressable
          onPress={() => scroller.current?.scrollTo({ y: 0, animated: true })} accessibilityLabel="Back to top"
          style={({ hovered }) => ({ position: 'absolute', right: 30, bottom: 30, width: 48, height: 48, borderRadius: 24, backgroundColor: hovered ? t.primaryHover : t.primary, alignItems: 'center', justifyContent: 'center', boxShadow: t.shadowSoft, zIndex: 99 })}
        >
          <Text style={{ color: '#fff', fontSize: 20 }}>↑</Text>
        </Pressable>
      )}

      <AuthModal visible={login} onClose={() => setLogin(false)} t={t} />
    </View>
  );
}
