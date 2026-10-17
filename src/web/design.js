// Design tokens copied from the ECollect PHP site (assets/css/styles.css + admin.css).
// Web only. The phone app keeps using src/theme.js.
export const SITE_NAME = 'ECollect';
export const SITE_TITLE = 'Barangay Poblacion Waste Collection Scheduling System';
export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';

const base = {
  primary: '#2e7d32',
  primaryHover: '#1b5e20',
  primaryLight: '#e8f5e9',
  secondary: '#1976d2',
  secondaryHover: '#0d47a1',
  amber: '#f57c00',
};

export const themes = {
  light: {
    ...base,
    bgBody: '#ffffff', bgSurface: '#ffffff', bgLight: '#f5f5f5',
    text: '#333333', muted: '#666666', border: '#e0e0e0',
    shadowSoft: '0 8px 30px rgba(0,0,0,0.08)', shadowHover: '0 14px 40px rgba(0,0,0,0.12)',
    glassBg: 'rgba(255,255,255,0.4)', glassBorder: 'rgba(255,255,255,0.3)',
  },
  dark: {
    ...base,
    bgBody: '#121212', bgSurface: '#1e1e1e', bgLight: '#252525',
    text: '#f5f5f5', muted: '#b0b0b0', border: '#333333',
    shadowSoft: '0 8px 30px rgba(0,0,0,0.4)', shadowHover: '0 14px 40px rgba(0,0,0,0.6)',
    glassBg: 'rgba(30,30,30,0.5)', glassBorder: 'rgba(255,255,255,0.1)',
  },
};

// Chart.js v4's automatic colours (the PHP dashboards never set colours, so these are what it showed).
export const chartPalette = ['rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(255, 159, 64)', 'rgb(255, 205, 86)', 'rgb(75, 192, 192)', 'rgb(153, 102, 255)', 'rgb(201, 203, 207)'];
export const chartBar = 'rgba(54, 162, 235, 0.5)';
