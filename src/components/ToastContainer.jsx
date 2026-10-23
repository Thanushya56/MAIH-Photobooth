/**
 * ToastContainer – renders stacked toast notifications
 */
import React from 'react';

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" role="alert" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => onRemove(t.id)}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
