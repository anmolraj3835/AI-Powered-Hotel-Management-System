import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { authService } from '@/services/auth.service';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const fillCredentials = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const authData = await authService.login(data.email.trim(), data.password);
      toast.success('Signed in successfully!');
      
      const emailLower = data.email.toLowerCase();
      const userRole = (authData.user?.user_metadata?.role || '').toUpperCase();

      if (userRole === 'ADMIN' || emailLower.includes('admin')) {
        navigate('/admin');
      } else if (userRole === 'STAFF' || emailLower.includes('staff')) {
        navigate('/staff');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please verify credentials.');
      } else if (msg.includes('Email not confirmed')) {
        toast.error('Please verify your email address before signing in');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Brand Side Panel */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 440 }}>
          <div style={{
            width: 68, height: 68, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 12px 32px rgba(37,99,235,0.4)'
          }}>
            <Building2 size={34} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '2.1rem', marginBottom: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            HotelAI Management
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.7, marginBottom: '32px' }}>
            Comprehensive hotel and hostel operations system for room bookings, guest service requests, housekeeping dispatch, and billing.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              { title: 'Room Catalog', desc: 'Live availability & bookings' },
              { title: 'Guest Services', desc: 'AI-assisted request tracking' },
              { title: 'Staff Dispatch', desc: 'Housekeeping & task duty' },
              { title: 'Operations Admin', desc: 'Revenue & occupancy analytics' },
            ].map((item) => (
              <div key={item.title} style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 12,
                padding: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left'
              }}>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>{item.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="auth-right">
        <div className="auth-form" style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>Sign in</h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Enter your email and password to access your portal.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
                    placeholder="name@hotel.com"
                    style={{ paddingLeft: '40px' }}
                    autoComplete="email"
                    {...register('email')}
                  />
                </div>
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="password">Password</label>
                  <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: '#9ca3af', pointerEvents: 'none'
                  }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
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

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
                style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? 'Authenticating...' : <><span>Sign in</span> <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>

          {/* Quick Credential Helpers */}
          <div style={{
            marginTop: '28px',
            padding: '14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '10px' }}>
              <ShieldCheck size={14} color="#2563eb" /> Default System Accounts (Click to Fill):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => fillCredentials('admin@hotel.com', 'admin123')}
                style={{
                  padding: '7px 4px', fontSize: '0.74rem', fontWeight: 600,
                  borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff',
                  color: '#1e293b', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('staff@hotel.com', 'staff123')}
                style={{
                  padding: '7px 4px', fontSize: '0.74rem', fontWeight: 600,
                  borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff',
                  color: '#1e293b', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('guest@hotel.com', 'guest123')}
                style={{
                  padding: '7px 4px', fontSize: '0.74rem', fontWeight: 600,
                  borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff',
                  color: '#1e293b', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                Guest
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: '#6b7280' }}>
            New guest?{' '}
            <Link to="/register" style={{ color: '#2563eb', fontWeight: 600 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
