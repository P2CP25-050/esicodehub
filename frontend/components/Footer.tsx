import { useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/axios';
import { isAxiosError } from 'axios';

const PROBLEM_CATEGORIES = [
  { value: 'bug', label: 'Bug / something is broken' },
  { value: 'ui_issue', label: 'UI / display issue' },
  { value: 'wrong_data', label: 'Wrong or missing data' },
  { value: 'missing_feature', label: 'Missing feature or suggestion' },
  { value: 'other', label: 'Other' },
];

// Footer is rendered inline at the end of the page (not fixed), so no body padding needed.

export default function Footer() {
  const [show, setShow] = useState(false);
  const [category, setCategory] = useState(PROBLEM_CATEGORIES[0].value);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [show]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/reports/problems/', {
        category,
        title: title.trim(),
        description: description.trim(),
        page_url: typeof window !== 'undefined' ? window.location.pathname : '',
      });
      setDone(true);
    } catch (err: unkown) {
      let msg = 'Failed to submit report. Please try again.';

      if (isAxiosError(err)) {
        const data = err.response?.data;
        if (data) {
          if (typeof data.detail === 'string') msg = data.detail;
          else if (typeof data === 'string') msg = data;
          else if (data?.non_field_errors && Array.isArray(data.non_field_errors)) msg = String(data.non_field_errors[0]);
        }
      }

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`\n        .fh-footer{box-sizing:border-box;padding:18px 24px;border-top:1px solid rgba(255,255,255,0.06);background:#0d1b2a;color:#fff;display:flex;align-items:center;justify-content:space-between;font-family:DM Sans,system-ui,Arial,sans-serif;position:relative;z-index:1000}\n        .fh-site{font-weight:700;font-size:14px;color:#fff}\n        .fh-report{background:#fff;color:#0d1b2a;border:none;padding:8px 12px;font-size:13px;border-radius:6px;cursor:pointer;font-weight:600;position:relative;z-index:1001}\n        .fh-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:2000}\n        .fh-panel{width:520px;max-width:92%;background:#fff;padding:18px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);z-index:2001}
        .fh-row{display:flex;gap:10px;margin-bottom:10px}\n        .fh-label{font-size:12px;color:#666;margin-bottom:6px;display:block}\n        .fh-input{width:100%;padding:10px;border:1px solid #e6e6e6;border-radius:6px;font-size:14px}\n        .fh-select{padding:10px;border:1px solid #e6e6e6;border-radius:6px;font-size:14px;background:#fff}
        .fh-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
        .fh-cancel{background:#fff;border:1px solid #e6e6e6;padding:8px 12px;border-radius:6px;cursor:pointer}
        .fh-primary{background:#1d6ef5;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer}
        .fh-error{color:#cc0000;font-weight:600;margin-top:8px}
        .fh-done{color:#1a7a3c;font-weight:700;margin-top:8px}
      `}</style>

      <footer className="fh-footer" role="contentinfo">
        <div className="fh-site">ESICodeHub</div>
        <div>
          <button className="fh-report" onClick={() => { setShow(true); setDone(false); setTitle(''); setDescription(''); setError(null); }}>
            Report an issue
          </button>
        </div>
      </footer>

      {show && (
        <div ref={overlayRef} className="fh-backdrop" onClick={(e) => { if (e.target === overlayRef.current) setShow(false); }}>
          <div className="fh-panel" role="dialog" aria-modal="true" aria-label="Report an issue">
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Report an issue</h3>
            <p style={{ margin: '6px 0 12px', color: '#666', fontSize: 13 }}>Tell us what went wrong on this page — we&apos;ll review it.</p>

            {done ? (
              <div>
                <p className="fh-done">Thanks — your report was submitted.</p>
                <div className="fh-actions">
                  <button className="fh-primary" onClick={() => setShow(false)}>Done</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <label className="fh-label">Category</label>
                  <select className="fh-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {PROBLEM_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label className="fh-label">Title</label>
                  <input className="fh-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
                </div>

                <div style={{ marginBottom: 6 }}>
                  <label className="fh-label">Details</label>
                  <textarea className="fh-input" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what happened, steps to reproduce, or screenshots (optional)" />
                </div>

                {error && <div className="fh-error">{error}</div>}

                <div className="fh-actions">
                  <button className="fh-cancel" onClick={() => setShow(false)} disabled={submitting}>Cancel</button>
                  <button className="fh-primary" onClick={handleSubmit} disabled={submitting || !title.trim()}>
                    {submitting ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
