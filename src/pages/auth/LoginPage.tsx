import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { authService } from '@/services/auth.service';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authService.login(data.email, data.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('Invalid login credentials')) {
        toast.error('Invalid email or password');
      } else if (msg.includes('Email not confirmed')) {
        toast.error('Please verify your email first');
      } else {
        toast.error(msg);
      }
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
            HotelAI
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: 1.7 }}>
            AI-powered hotel operations for guests, housekeeping staff, and managers — bookings, service requests, and billing in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '40px' }}>
            {[
              { icon: '🤖', title: 'AI Requests', desc: 'Instant category & priority' },
              { icon: '🛏️', title: 'Room Catalog', desc: 'Live availability' },
              { icon: '📊', title: 'Analytics', desc: 'Revenue & occupancy' },
              { icon: '🛎️', title: 'Guest Stay', desc: 'Service & check-out' },
            ].map((item) => (
              <div key={item.title} style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 12,
                padding: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left'
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{item.icon}</div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>{item.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form">
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>Sign in</h2>
            <p style={{ color: '#6b7280' }}>Guests, staff, and managers use the same portal.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: '#9ca3af', pointerEvents: 'none'
                  }} />
                  <input
                    id="email"
                    type="email"
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    placeholder="you@example.com"
                    style={{ paddingLeft: '40px' }}
                    autoComplete="email"
                    {...register('email')}
                  />
                </div>
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: '#9ca3af', pointerEvents: 'none'
                  }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="Min. 6 characters"
                    style={{ paddingLeft: '40px', paddingRight: '40px' }}
                    autoComplete="current-password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password.message}</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#2563eb', fontWeight: 500 }}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: '#6b7280' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#2563eb', fontWeight: 600 }}>Create guest account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
