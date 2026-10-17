import React from 'react';

/** Inline SVG icon (web only). `d` is a path string or a list of them. Paths are the ones used by the PHP site. */
export function Icon({ d, size = 18, color = '#000', stroke = false, strokeWidth = 2, style }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', flexShrink: 0, ...style }}
      fill={stroke ? 'none' : color} stroke={stroke ? color : 'none'}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    >
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

export const P = {
  // sidebar / stat icons
  grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  routes: 'M9 3 5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z',
  calendar: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8H5v10h14V10z',
  person: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-7 9a7 7 0 0 1 14 0H5z',
  waste: 'M6 7h12l-1 13H7L6 7zm3-4h6l1 2H8l1-2z',
  bubble: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z',
  users: ['M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z', 'M8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z', 'M16 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z', 'M8 13c-2.33 0-7 1.17-7 3.5V19h7v-2.5c0-.93.32-1.76.88-2.47A8.2 8.2 0 0 0 8 13z'],
  collector: ['M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M5 21c0-4.42 3.13-8 7-8s7 3.58 7 8H5z'],
  truck: ['M3 6h11v10H3V6zm11 3h3l4 4v3h-7V9z', 'M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z', 'M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'],
  road: ['M7 4a3 3 0 1 0 0 6h10a3 3 0 1 0 0-6H7zm0 2h10a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z', 'M7 14a3 3 0 1 0 0 6h10a3 3 0 1 0 0-6H7zm0 2h10a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z'],
  megaphone: 'M3 10v4h4l5 4V6l-5 4H3zm12.5 2a3.5 3.5 0 0 0-2.5-3.35v6.7A3.5 3.5 0 0 0 15.5 12z',
  feedback: 'M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  resident: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M4 21c0-4 3.58-7 8-7s8 3 8 7H4z'],
  reports: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 12h2v3H8v-3zm3-5h2v8h-2v-8zm3 3h2v5h-2v-5z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z',
  empty: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14z',
  // stroked icons
  logo: ['M7 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7z', 'M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  sun: ['M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  aboutTruck: ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7V8z', 'M8 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z', 'M21 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};
