// Shared page parts (page_head, readonly_banner, render_messages, empty_state from the PHP version).
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { usePanel } from './Layout';

/** Sets the top-bar title and prints the page heading block. */
export function PageHead({ title, topTitle, desc, children }) {
  const panel = usePanel();
  useEffect(() => { panel?.setTitle(topTitle ?? title); }, [panel, title, topTitle]);
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </div>
  );
}

export function ReadonlyBanner({ children }) {
  return <div className="readonly-banner"><Icon name="eye" /><span>{children}</span></div>;
}

/** Errors (one per line) and success messages above a form. */
export function Messages({ errors = [], success = '' }) {
  return (
    <>
      {errors.length > 0 && (
        <div className="flash-stack"><div className="alert alert-error" role="alert">{errors.map((e, i) => <p key={i}>{e}</p>)}</div></div>
      )}
      {success && <div className="flash-stack"><div className="alert alert-success" role="status"><p>{success}</p></div></div>}
    </>
  );
}

export function Empty({ title, text, icon = 'calendar' }) {
  return <div className="empty"><Icon name={icon} /><strong>{title}</strong><span>{text}</span></div>;
}

export function Loading({ label = 'Loading…' }) {
  return <div className="empty" aria-busy="true"><div className="skeleton" style={{ height: 14, width: 180 }} /><span>{label}</span></div>;
}

export function LoadError({ message, onRetry }) {
  return (
    <div className="alert alert-error mb" role="alert">
      <p>{message || 'The data could not be loaded.'}</p>
      {onRetry && <p style={{ marginTop: 8 }}><button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}><Icon name="refresh" />Try again</button></p>}
    </div>
  );
}

/** Flash message that survives a navigation (like the PHP flash()). */
const FLASH_KEY = 'ecollect-flash';
export function flash(type, message) {
  try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message })); } catch { /* ignore */ }
}
export function FlashMessage() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (raw) { setMsg(JSON.parse(raw)); sessionStorage.removeItem(FLASH_KEY); }
    } catch { /* ignore */ }
  }, []);
  if (!msg) return null;
  const cls = msg.type === 'error' ? 'alert-error' : msg.type === 'info' ? 'alert-info' : 'alert-success';
  return <div className="flash-stack"><div className={`alert ${cls}`} role={msg.type === 'error' ? 'alert' : 'status'}><p>{msg.message}</p></div></div>;
}

/**
 * Loads data with an async function; reload() re-runs it.
 * Returns { data, error, loading, reload }.
 */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const seq = useRef(0);
  const run = async () => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fn();
      if (n === seq.current) setState({ data, error: '', loading: false });
    } catch (e) {
      if (n === seq.current) setState((s) => ({ ...s, error: e.message || 'The data could not be loaded.', loading: false }));
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { ...state, reload: run };
}

export const zoneBadgeStyle = (color, small) => (small
  ? { display: 'inline-grid', width: 18, height: 18, fontSize: 10, marginRight: 6, verticalAlign: -3, background: color }
  : { background: color });
