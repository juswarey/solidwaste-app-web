import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { sendLocation } from '../data/collector';

const Ctx = createContext(null);
export const useLocationShare = () => useContext(Ctx);

const TAG = 'ecollect-sharing';
const keepAwakeOn = () => { try { activateKeepAwakeAsync(TAG); } catch { /* ignore */ } };
const keepAwakeOff = () => { try { deactivateKeepAwake(TAG); } catch { /* ignore */ } };

/**
 * Sends the phone's GPS position to the server every ~15 seconds while sharing is on.
 * Works while the app is open (foreground). Stops automatically on log out.
 */
export function LocationShareProvider({ children }) {
  const [sharing, setSharing] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [error, setError] = useState('');
  const subRef = useRef(null);
  const lastPostRef = useRef(0);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    keepAwakeOff();
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Allow location access to share your truck’s position.');
      return;
    }
    try {
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 0 },
        async (pos) => {
          const now = Date.now();
          if (now - lastPostRef.current < 10000) return;
          lastPostRef.current = now;
          try {
            await sendLocation(pos.coords.latitude, pos.coords.longitude);
            setLastSentAt(new Date());
            setError('');
          } catch (e) {
            setError(e.message);
          }
        }
      );
      keepAwakeOn();
      setSharing(true);
    } catch {
      setError('Could not start GPS. Turn on location services and try again.');
    }
  }, []);

  useEffect(() => () => { subRef.current?.remove(); keepAwakeOff(); }, []);

  const value = useMemo(
    () => ({ sharing, lastSentAt, error, start, stop }),
    [sharing, lastSentAt, error, start, stop]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
