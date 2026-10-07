/**
 * Edge Function: analyze-complaint
 * Performs AI analysis on a complaint: category, priority, sentiment
 * Uses TF-IDF + Logistic Regression (pure TS, no external AI API)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL_VERSION = '1.0.0';
const CONFIDENCE_THRESHOLD = 0.65;

// ============================================================
// TRAINING DATA & ML (same logic as frontend, runs server-side)
// ============================================================

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'my',
  'our', 'this', 'that', 'it', 'and', 'or', 'so', 'because', 'please', 'kindly',
  'sir', 'madam', 'help', 'solve', 'issue', 'issues', 'problem', 'urgent', 'need',
  'we', 'i', 'you', 'he', 'she', 'they', 'do', 'not', 'very', 'also', 'but',
  'there', 'here', 'as', 'into', 'its', 'if', 'about', 'which', 'when',
]);

const TRAINING_DATA = [
  { text: 'The WiFi has stopped working in my room', category: 'INTERNET_WIFI' },
  { text: 'Internet connection is very slow and keeps disconnecting', category: 'INTERNET_WIFI' },
  { text: 'No network signal in block third floor', category: 'INTERNET_WIFI' },
  { text: 'LAN cable not working at my desk port', category: 'INTERNET_WIFI' },
  { text: 'Cannot connect to hostel network from my laptop', category: 'INTERNET_WIFI' },
  { text: 'Broadband connection has been down since yesterday', category: 'INTERNET_WIFI' },
  { text: 'WiFi signal is very weak on the top floor', category: 'INTERNET_WIFI' },
  { text: 'Power socket not working in room', category: 'ELECTRICAL' },
  { text: 'Short circuit in the main switch board', category: 'ELECTRICAL' },
  { text: 'Electricity supply cut for entire floor since morning', category: 'ELECTRICAL' },
  { text: 'Tubelight is fused and needs replacement', category: 'ELECTRICAL' },
  { text: 'Electric sparks from wall socket dangerous', category: 'ELECTRICAL' },
  { text: 'MCB keeps tripping when we turn on the room heater', category: 'ELECTRICAL' },
  { text: 'Corridor lights not working for 3 days', category: 'ELECTRICAL' },
  { text: 'Bathroom tap is constantly leaking water', category: 'PLUMBING' },
  { text: 'Toilet flush is broken and not flushing properly', category: 'PLUMBING' },
  { text: 'Water supply is blocked in my washroom', category: 'PLUMBING' },
  { text: 'Drainage pipe is choked and water overflowing', category: 'PLUMBING' },
  { text: 'Hot water geyser is not heating water', category: 'PLUMBING' },
  { text: 'Water pressure is very low in shower', category: 'PLUMBING' },
  { text: 'Room has not been cleaned for a week', category: 'CLEANING' },
  { text: 'Dustbin in corridor is overflowing with garbage', category: 'CLEANING' },
  { text: 'Common bathroom is very dirty and unhygienic', category: 'CLEANING' },
  { text: 'Bed frame is broken and making noise', category: 'FURNITURE' },
  { text: 'Wardrobe door hinge is damaged cannot close', category: 'FURNITURE' },
  { text: 'Study table chair is broken leg fell off', category: 'FURNITURE' },
  { text: 'Cupboard lock is jammed cannot open', category: 'FURNITURE' },
  { text: 'Bathroom door lock is broken cannot lock from inside', category: 'BATHROOM' },
  { text: 'Shower head is not working properly', category: 'BATHROOM' },
  { text: 'Bathroom floor always wet and slippery dangerous', category: 'BATHROOM' },
  { text: 'No water supply in hostel since morning', category: 'WATER' },
  { text: 'Water tastes bad and seems contaminated', category: 'WATER' },
  { text: 'Water cooler on ground floor not cooling water', category: 'WATER' },
  { text: 'Drinking water not available on second floor', category: 'WATER' },
  { text: 'Ceiling fan is making loud rattling noise', category: 'AC_FAN' },
  { text: 'Air conditioner not cooling the room at all', category: 'AC_FAN' },
  { text: 'Fan regulator is not working speed stuck at max', category: 'AC_FAN' },
  { text: 'AC is leaking water and dripping on floor', category: 'AC_FAN' },
  { text: 'Main gate security camera is not working', category: 'SECURITY' },
  { text: 'Unauthorized outsiders seen in hostel premises at night', category: 'SECURITY' },
  { text: 'Hostel entry gate lock is broken anyone can enter', category: 'SECURITY' },
  { text: 'Room was broken into and belongings stolen', category: 'SECURITY' },
  { text: 'Food served today in mess was spoiled and stale', category: 'FOOD_MESS' },
  { text: 'Quality of breakfast has degraded significantly', category: 'FOOD_MESS' },
  { text: 'Found insects in dal served at lunch today', category: 'FOOD_MESS' },
  { text: 'Vegetables cooked are undercooked and tasteless', category: 'FOOD_MESS' },
  { text: 'Washing machine in laundry room is not working', category: 'LAUNDRY' },
  { text: 'Clothes returned from laundry service are not clean', category: 'LAUNDRY' },
  { text: 'Paint peeling from ceiling and falling in room', category: 'MAINTENANCE' },
  { text: 'Window glass broken and cold wind entering room', category: 'MAINTENANCE' },
  { text: 'Staircase railing is broken and dangerous to use', category: 'MAINTENANCE' },
  { text: 'Elevator is not working stuck at ground floor', category: 'MAINTENANCE' },
  { text: 'Loud noise from neighboring room disturbing studies', category: 'NOISE' },
  { text: 'Music is being played very loudly at night', category: 'NOISE' },
  { text: 'Need extra blanket as it is too cold in room', category: 'OTHER' },
  { text: 'Request for extension of hostel curfew timing', category: 'OTHER' },
];

// TF-IDF Logistic Regression (same as frontend)
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function buildModel() {
  const docs = TRAINING_DATA.map((d) => d.text);
  const categories = Array.from(new Set(TRAINING_DATA.map((d) => d.category)));
  const docFreq = new Map<string, number>();
  docs.forEach((doc) => {
    const tokens = new Set(tokenize(doc));
    tokens.forEach((t) => docFreq.set(t, (docFreq.get(t) || 0) + 1));
  });
  const vocabulary = new Map<string, number>();
  const idf: number[] = [];
  let idx = 0;
  docFreq.forEach((df, term) => {
    vocabulary.set(term, idx);
    idf[idx] = Math.log((1 + docs.length) / (1 + df)) + 1;
    idx++;
  });

  function vectorize(text: string): number[] {
    const vec = new Array(vocabulary.size).fill(0);
    tokenize(text).forEach((t) => { const i = vocabulary.get(t); if (i !== undefined) vec[i] += 1; });
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      if (vec[i] > 0) { vec[i] = (1 + Math.log(vec[i])) * idf[i]; norm += vec[i] * vec[i]; }
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
  }

  const K = categories.length, D = vocabulary.size;
  const weights = Array.from({ length: K }, () => new Array(D).fill(0));
  const biases = new Array(K).fill(0);
  const X = docs.map(vectorize);
  const Y = TRAINING_DATA.map((d) => categories.indexOf(d.category));

  const softmax = (logits: number[]) => {
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  };

  for (let epoch = 0; epoch < 150; epoch++) {
    for (let i = 0; i < TRAINING_DATA.length; i++) {
      const x = X[i], target = Y[i];
      const logits = weights.map((wk, k) => {
        let dot = biases[k];
        for (let j = 0; j < D; j++) if (x[j] !== 0) dot += wk[j] * x[j];
        return dot;
      });
      const probs = softmax(logits);
      for (let k = 0; k < K; k++) {
        const err = probs[k] - (k === target ? 1 : 0);
        biases[k] -= 0.15 * err;
        for (let j = 0; j < D; j++) if (x[j] !== 0) weights[k][j] -= 0.15 * err * x[j];
      }
    }
  }

  return { categories, vocabulary, idf, weights, biases, vectorize, softmax };
}

let cachedModel: ReturnType<typeof buildModel> | null = null;
function getModel() {
  if (!cachedModel) cachedModel = buildModel();
  return cachedModel;
}

function classifyCategory(text: string) {
  const { categories, weights, biases, vectorize, softmax } = getModel();
  const x = vectorize(text);
  const logits = weights.map((wk, k) => {
    let dot = biases[k];
    for (let j = 0; j < wk.length; j++) if (x[j] !== 0) dot += wk[j] * x[j];
    return dot;
  });
  const probs = softmax(logits);
  let bestIdx = 0;
  const scores: Record<string, number> = {};
  probs.forEach((p, k) => {
    scores[categories[k]] = parseFloat(p.toFixed(4));
    if (p > probs[bestIdx]) bestIdx = k;
  });
  return { category: categories[bestIdx], confidence: parseFloat(probs[bestIdx].toFixed(4)), scores };
}

function classifyPriority(text: string, category: string): { priority: string; confidence: number } {
  const lower = text.toLowerCase();
  const CRITICAL_KW = ['fire', 'explosion', 'electrocution', 'sparking', 'spark', 'short circuit', 'emergency', 'injury', 'collapse', 'gas leak', 'flooding', 'dangerous', 'stolen', 'broken into'];
  const HIGH_KW = ['no water', 'no electricity', 'entire block', 'entire floor', 'contaminated', 'sewage', 'overflow', 'unauthorized', 'security breach', 'major leak'];
  const CRITICAL_CATS = ['SECURITY'];
  const HIGH_CATS = ['ELECTRICAL', 'WATER', 'PLUMBING'];
  const MEDIUM_CATS = ['INTERNET_WIFI', 'CLEANING', 'FOOD_MESS', 'MAINTENANCE'];

  if (CRITICAL_KW.some((kw) => lower.includes(kw))) return { priority: 'CRITICAL', confidence: 0.90 };
  if (HIGH_KW.some((kw) => lower.includes(kw)) || CRITICAL_CATS.includes(category)) return { priority: 'HIGH', confidence: 0.80 };
  if (HIGH_CATS.includes(category)) return { priority: 'MEDIUM', confidence: 0.72 };
  if (MEDIUM_CATS.includes(category)) return { priority: 'MEDIUM', confidence: 0.70 };
  return { priority: 'LOW', confidence: 0.75 };
}

function analyzeSentiment(text: string): { sentiment: string; confidence: number } {
  const lower = text.toLowerCase();
  const POS = ['good', 'great', 'excellent', 'nice', 'happy', 'satisfied', 'resolved', 'fixed', 'clean', 'appreciate', 'thank'];
  const NEG = ['bad', 'terrible', 'awful', 'horrible', 'broken', 'damaged', 'dirty', 'rotten', 'spoiled', 'dangerous', 'unhygienic', 'disgusting', 'worst', 'not working', 'leaking', 'blocked', 'stale', 'foul'];
  let pos = 0, neg = 0;
  POS.forEach((w) => { if (lower.includes(w)) pos++; });
  NEG.forEach((w) => { if (lower.includes(w)) neg++; });
  const total = pos + neg || 1;
  if (neg > pos) return { sentiment: 'NEGATIVE', confidence: parseFloat((neg / total).toFixed(2)) };
  if (pos > neg) return { sentiment: 'POSITIVE', confidence: parseFloat((pos / total).toFixed(2)) };
  return { sentiment: 'NEUTRAL', confidence: 0.60 };
}

const DEPT_MAP: Record<string, string> = {
  INTERNET_WIFI: 'IT', ELECTRICAL: 'ELEC', PLUMBING: 'PLMB', CLEANING: 'HOUSE',
  FURNITURE: 'FURN', BATHROOM: 'PLMB', WATER: 'PLMB', AC_FAN: 'ELEC',
  SECURITY: 'SEC', FOOD_MESS: 'MESS', LAUNDRY: 'LAUN', MAINTENANCE: 'GEN',
  NOISE: 'GEN', OTHER: 'GEN',
};

// ============================================================
// HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user-scoped client (preserves RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { complaint_id, title, description } = await req.json();
    if (!complaint_id || !title || !description) {
      return new Response(JSON.stringify({ error: 'complaint_id, title, and description are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = `${title} ${description}`;

    // Run predictions
    const catResult = classifyCategory(text);
    const priResult = classifyPriority(text, catResult.category);
    const senResult = analyzeSentiment(text);
    const deptCode = DEPT_MAP[catResult.category] || 'GEN';

    // Look up department ID
    const { data: dept } = await supabase
      .from('departments')
      .select('id')
      .eq('code', deptCode)
      .maybeSingle();

    const prediction = {
      complaint_id,
      predicted_category: catResult.category,
      category_confidence: catResult.confidence,
      category_review_required: catResult.confidence < CONFIDENCE_THRESHOLD,
      predicted_priority: priResult.priority,
      priority_confidence: priResult.confidence,
      priority_review_required: priResult.confidence < CONFIDENCE_THRESHOLD,
      predicted_sentiment: senResult.sentiment,
      sentiment_confidence: senResult.confidence,
      recommended_department_id: dept?.id || null,
      model_version: MODEL_VERSION,
      raw_scores: catResult.scores,
    };

    // Save prediction
    const { error: predError } = await supabase
      .from('complaint_predictions')
      .upsert(prediction, { onConflict: 'complaint_id' });
    if (predError) throw predError;

    // Update complaint with AI results
    const { error: compError } = await supabase
      .from('complaints')
      .update({
        category: catResult.category,
        priority: priResult.priority,
        department_id: dept?.id || null,
        status: 'AI_ANALYZED',
      })
      .eq('id', complaint_id);
    if (compError) throw compError;

    return new Response(JSON.stringify({ success: true, prediction }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
