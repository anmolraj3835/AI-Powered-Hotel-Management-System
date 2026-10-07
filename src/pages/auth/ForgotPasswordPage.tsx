import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft } from 'lucide-react';
import { authService } from '@/services/auth.service';

const schema = z.object({
  email: z.string().email('Valid email required'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authService.resetPassword(data.email);
      setSent(true);
      toast.success('Password reset email sent!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f9fafb', padding: '16px'
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', padding: '48px 40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '0.875rem', color: '#6b7280', marginBottom: '32px', textDecoration: 'none'
        }}>
          <ArrowLeft size={16} /> Back to login
        </Link>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, background: '#dcfce7', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <Mail size={28} color="#16a34a" />
            </div>
            <h2 style={{ fontWeight: 800, marginBottom: '12px', fontSize: '1.5rem' }}>Check your email</h2>
            <p style={{ color: '#6b7280', lineHeight: 1.7 }}>
              We've sent a password reset link to your email address. Please check your inbox and click the link to reset your password.
            </p>
            <Link to="/login" className="btn btn-primary btn-lg" style={{ marginTop: '24px', display: 'block', textAlign: 'center' }}>
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Forgot password?</h2>
            <p style={{ color: '#6b7280', marginBottom: '32px' }}>
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
