import React from 'react';
import { useAuth } from '../../AuthContext';
import BarangayDashboard from './BarangayDashboard';
import LguDashboard from './LguDashboard';

/** The look comes from the PHP site's two dashboards; which one shows depends on the signed-in role. */
export default function Dashboard({ go }) {
  const { role } = useAuth();
  return role === 'lgu_admin' ? <LguDashboard go={go} /> : <BarangayDashboard go={go} />;
}
