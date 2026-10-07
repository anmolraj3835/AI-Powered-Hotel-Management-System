import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Process escalation:
 * - Find complaints with breached SLA
 * - Mark them as escalated
 * - Create notifications for admins
 * Can be triggered by Supabase cron or admin API call
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // This function uses service role to check SLA across all complaints
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();

    // Find complaints that have breached SLA
    const { data: breachedComplaints, error } = await supabaseAdmin
      .from('complaints')
      .select('id, complaint_number, priority, title, student_id, hostel_id, assigned_to')
      .lt('sla_due_at', now)
      .not('status', 'in', '(RESOLVED,CLOSED,CANCELLED)')
      .eq('is_escalated', false)
      .limit(50);

    if (error) throw error;

    const escalated: string[] = [];

    for (const complaint of breachedComplaints || []) {
      // Mark as escalated
      await supabaseAdmin
        .from('complaints')
        .update({
          is_escalated: true,
          escalated_at: now,
          escalation_reason: 'SLA breach - automatic escalation',
          sla_status: 'BREACHED',
        })
        .eq('id', complaint.id);

      // Notify admin
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['HOSTEL_ADMIN', 'SUPER_ADMIN'])
        .eq('is_active', true);

      for (const admin of admins || []) {
        await supabaseAdmin.from('notifications').insert({
          user_id: admin.id,
          title: `SLA Breach: ${complaint.complaint_number}`,
          message: `Complaint "${complaint.title}" has exceeded its SLA deadline (Priority: ${complaint.priority}).`,
          type: 'WARNING',
          entity_type: 'complaint',
          entity_id: complaint.id,
          action_url: `/complaints/${complaint.id}`,
        });
      }

      escalated.push(complaint.id);
    }

    return new Response(JSON.stringify({ success: true, escalated_count: escalated.length, escalated_ids: escalated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
