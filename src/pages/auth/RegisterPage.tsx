import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authService.register({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
      });
      toast.success('Account created! Please check your email to verify.');
      navigate('/login');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 440 }}>
          <div style={{
            width: 72, height: 72, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 12px 32px rgba(37,99,235,0.4)'
          }}>
            <Building2 size={36} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '2rem', marginBottom: '16px', fontWeight: 800 }}>
            Join HotelAI
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: 1.7 }}>
            Create your guest account to book rooms, raise service requests, and manage your stay.
          </p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form">
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>Create account</h2>
            <p style={{ color: '#6b7280' }}>Fill in your details below to get started.</p>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#b91c1c', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="full_name">Full Name</label>
                <input id="full_name" name="full_name" type="text" className="form-input"
                  placeholder="John Doe" value={form.full_name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input id="email" name="email" type="email" className="form-input"
                  placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone Number</label>
                <input id="phone" name="phone" type="tel" className="form-input"
                  placeholder="+91 9876543210" value={form.phone} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input id="password" name="password" type="password" className="form-input"
                  placeholder="Min. 8 characters" value={form.password} onChange={handleChange} required autoComplete="new-password" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm_password">Confirm Password</label>
                <input id="confirm_password" name="confirm_password" type="password" className="form-input"
                  placeholder="Re-enter password" value={form.confirm_password} onChange={handleChange} required autoComplete="new-password" />
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: '#6b7280' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
