import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export default function LoadingScreen() {
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkip(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSkip = () => {
    const store = useAuthStore.getState();
    store.setLoading(false);
    store.setInitialized(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f9fafb', zIndex: 9999, flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: 48, height: 48, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(37,99,235,0.35)'
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2563eb',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto'
        }} />
      </div>

      {showSkip && (
        <div style={{ marginTop: '12px', textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>
            Taking longer than usual?
          </p>
          <button
            onClick={handleSkip}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#2563eb',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Continue to App →
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
