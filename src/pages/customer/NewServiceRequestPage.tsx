import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { classifyComplaintAsync } from '@/ml/complaintClassifier';
import type { ServiceRequestCategory } from '@/types/database';

const CATEGORIES: ServiceRequestCategory[] = ['HOUSEKEEPING', 'ROOM_SERVICE', 'MAINTENANCE', 'LAUNDRY', 'OTHER'];

export default function NewServiceRequestPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: '' as ServiceRequestCategory | '' });
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from('bookings').select('id').eq('customer_id', profile.id)
      .in('status', ['CONFIRMED', 'CHECKED_IN']).limit(1).maybeSingle()
      .then(({ data }) => setActiveBookingId(data?.id ?? null));
  }, [profile]);

  // AI-powered live suggestion — async, runs in Web Worker (no UI freeze)
  useEffect(() => {
    if (form.title.length < 5) { setAiSuggestion(null); return; }

    // Debounce: wait 400ms after the user stops typing before calling the worker
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await classifyComplaintAsync(form.title, form.description);
        setAiSuggestion({
          category: result.category.category as string,
          confidence: result.category.confidence,
        });
      } catch {
        // Worker error — silently skip suggestion
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.title, form.description]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate fields
    if (!form.title.trim()) {
      toast.error('Please enter a title for your request');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    if (!profile) {
      toast.error('Please sign in to submit service requests');
      return;
    }

    const category = (form.category || aiSuggestion?.category || 'OTHER') as ServiceRequestCategory;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('service_requests').insert({
        customer_id: profile.id,
        booking_id: activeBookingId ?? null,
        title: form.title.trim(),
        description: form.description.trim(),
        category,
        priority: 'MEDIUM',
        status: 'PENDING',
        ai_confidence: aiSuggestion?.confidence ?? null,
      });
      if (error) throw error;
      toast.success('Service request submitted successfully!');
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      if (msg.includes('violates foreign key')) {
        toast.error('Account not found in database. Please register a new account.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="page-header">
        <h1>New Service Request</h1>
        <p>Describe your issue and we will assign staff to help you.</p>
      </div>
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label required">Title</label>
              <input className="form-input" placeholder="e.g. AC not working" required
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            {aiSuggestion && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                🤖 <strong>AI Suggestion:</strong> Category — <strong>{aiSuggestion.category.replace('_', ' ')}</strong>
                &nbsp;({Math.round(aiSuggestion.confidence * 100)}% confidence)
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Category (override AI)</label>
              <select className="form-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ServiceRequestCategory }))}>
                <option value="">Auto-detect (recommended)</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Description</label>
              <textarea className="form-textarea" rows={4} placeholder="Describe the issue in detail…" required
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
