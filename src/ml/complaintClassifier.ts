/**
 * AI Service Request Classifier
 * Pure TypeScript TF-IDF + Logistic Regression
 * Instant category & priority suggestions as guests type.
 */

import type { ComplaintCategory, ComplaintPriority, SentimentType } from '@/types/database';

export const CONFIDENCE_THRESHOLD = 0.65;
export const MODEL_VERSION = '2.0.0';

export interface CategoryPrediction {
  category: ComplaintCategory;
  confidence: number;
  reviewRequired: boolean;
  allScores: Partial<Record<ComplaintCategory, number>>;
}

export interface PriorityPrediction {
  priority: ComplaintPriority;
  confidence: number;
  reviewRequired: boolean;
}

export interface SentimentPrediction {
  sentiment: SentimentType;
  confidence: number;
}

export interface FullPrediction {
  category: CategoryPrediction;
  priority: PriorityPrediction;
  sentiment: SentimentPrediction;
  modelVersion: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'my',
  'our', 'this', 'that', 'it', 'and', 'or', 'so', 'because', 'please', 'kindly',
  'sir', 'madam', 'help', 'solve', 'issue', 'issues', 'problem', 'urgent', 'need',
  'we', 'i', 'you', 'he', 'she', 'they', 'do', 'not', 'very', 'also', 'but',
  'there', 'here', 'as', 'into', 'its', 'if', 'about', 'which', 'when', 'room',
]);

const TRAINING_DATA: Array<{ text: string; category: ComplaintCategory }> = [
  { text: 'Please clean my room and change the bed sheets', category: 'HOUSEKEEPING' },
  { text: 'Housekeeping has not cleaned the bathroom today', category: 'HOUSEKEEPING' },
  { text: 'Need extra towels and toiletries in the room', category: 'HOUSEKEEPING' },
  { text: 'Dustbin is overflowing please empty it', category: 'HOUSEKEEPING' },
  { text: 'Request for turndown service this evening', category: 'HOUSEKEEPING' },
  { text: 'Room is dusty and floor needs mopping', category: 'HOUSEKEEPING' },
  { text: 'Please change pillows and make the bed', category: 'HOUSEKEEPING' },
  { text: 'Bathroom is dirty and needs sanitizing', category: 'HOUSEKEEPING' },
  { text: 'Need more drinking water bottles and cups', category: 'HOUSEKEEPING' },
  { text: 'Please vacuum the carpet and wipe surfaces', category: 'HOUSEKEEPING' },

  { text: 'I would like to order breakfast to my room', category: 'ROOM_SERVICE' },
  { text: 'Please send club sandwich and coffee', category: 'ROOM_SERVICE' },
  { text: 'Can I get dinner menu delivered to suite', category: 'ROOM_SERVICE' },
  { text: 'Order pasta salad and a bottle of water', category: 'ROOM_SERVICE' },
  { text: 'Hungry and want food delivered now', category: 'ROOM_SERVICE' },
  { text: 'Please bring tea and cookies to room', category: 'ROOM_SERVICE' },
  { text: 'Late night snack burger and fries', category: 'ROOM_SERVICE' },
  { text: 'Vegetarian meal order for two guests', category: 'ROOM_SERVICE' },
  { text: 'Champagne and strawberries for anniversary', category: 'ROOM_SERVICE' },
  { text: 'Need room dining breakfast tray at 8am', category: 'ROOM_SERVICE' },

  { text: 'Air conditioner is not cooling the room', category: 'MAINTENANCE' },
  { text: 'Bathroom tap is leaking water constantly', category: 'MAINTENANCE' },
  { text: 'Television remote is not working', category: 'MAINTENANCE' },
  { text: 'Power socket near the bed is dead', category: 'MAINTENANCE' },
  { text: 'Light bulb fused and needs replacement', category: 'MAINTENANCE' },
  { text: 'Window latch is broken cannot close', category: 'MAINTENANCE' },
  { text: 'Shower has no hot water at all', category: 'MAINTENANCE' },
  { text: 'WiFi router in room keeps disconnecting', category: 'MAINTENANCE' },
  { text: 'Door lock is jammed cannot open properly', category: 'MAINTENANCE' },
  { text: 'Ceiling leak dripping onto the carpet', category: 'MAINTENANCE' },
  { text: 'Minibar fridge is not cooling drinks', category: 'MAINTENANCE' },
  { text: 'Safe in closet will not open', category: 'MAINTENANCE' },

  { text: 'Please collect laundry for wash and iron', category: 'LAUNDRY' },
  { text: 'Clothes need dry cleaning by tomorrow', category: 'LAUNDRY' },
  { text: 'Shirt staining needs laundry service', category: 'LAUNDRY' },
  { text: 'Return washed clothes to the wardrobe', category: 'LAUNDRY' },
  { text: 'Express laundry for suit and dresses', category: 'LAUNDRY' },
  { text: 'Need ironing service for formal wear', category: 'LAUNDRY' },
  { text: 'Pickup dirty clothes bag from bathroom', category: 'LAUNDRY' },
  { text: 'Washing machine request for guest garments', category: 'LAUNDRY' },

  { text: 'Need extra blanket it is too cold', category: 'OTHER' },
  { text: 'Request late checkout if possible', category: 'OTHER' },
  { text: 'Lost luggage enquiry at the front desk', category: 'OTHER' },
  { text: 'Need airport taxi booking assistance', category: 'OTHER' },
];

class TfIdfLogisticClassifier {
  private vocabulary: Map<string, number> = new Map();
  private idf: number[] = [];
  private categories: ComplaintCategory[] = [];
  private weights: number[][] = [];
  private biases: number[] = [];
  private trained = false;

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  private fitVocabulary(docs: string[]): void {
    const docFreq = new Map<string, number>();
    docs.forEach((doc) => {
      const tokens = new Set(this.tokenize(doc));
      tokens.forEach((t) => docFreq.set(t, (docFreq.get(t) || 0) + 1));
    });

    let idx = 0;
    docFreq.forEach((df, term) => {
      if (df >= 1) {
        this.vocabulary.set(term, idx);
        this.idf[idx] = Math.log((1 + docs.length) / (1 + df)) + 1;
        idx++;
      }
    });
  }

  private vectorize(text: string): number[] {
    const vec = new Array(this.vocabulary.size).fill(0);
    const tokens = this.tokenize(text);
    tokens.forEach((t) => {
      const i = this.vocabulary.get(t);
      if (i !== undefined) vec[i] += 1;
    });
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      if (vec[i] > 0) {
        vec[i] = (1 + Math.log(vec[i])) * this.idf[i];
        norm += vec[i] * vec[i];
      }
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
  }

  private softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  }

  train(dataset: Array<{ text: string; category: ComplaintCategory }>): void {
    const docs = dataset.map((d) => d.text);
    this.fitVocabulary(docs);
    this.categories = Array.from(new Set(dataset.map((d) => d.category))) as ComplaintCategory[];

    const K = this.categories.length;
    const D = this.vocabulary.size;
    this.weights = Array.from({ length: K }, () => new Array(D).fill(0));
    this.biases = new Array(K).fill(0);

    const X = docs.map((doc) => this.vectorize(doc));
    const Y = dataset.map((d) => this.categories.indexOf(d.category));

    const epochs = 150;
    const lr = 0.15;

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < dataset.length; i++) {
        const x = X[i];
        const target = Y[i];
        const logits = this.weights.map((wk, k) => {
          let dot = this.biases[k];
          for (let j = 0; j < D; j++) if (x[j] !== 0) dot += wk[j] * x[j];
          return dot;
        });
        const probs = this.softmax(logits);
        for (let k = 0; k < K; k++) {
          const err = probs[k] - (k === target ? 1 : 0);
          this.biases[k] -= lr * err;
          for (let j = 0; j < D; j++) {
            if (x[j] !== 0) this.weights[k][j] -= lr * err * x[j];
          }
        }
      }
    }
    this.trained = true;
  }

  predict(text: string): { category: ComplaintCategory; confidence: number; scores: Partial<Record<ComplaintCategory, number>> } {
    if (!this.trained) this.train(TRAINING_DATA);
    const x = this.vectorize(text);
    const logits = this.weights.map((wk, k) => {
      let dot = this.biases[k];
      for (let j = 0; j < wk.length; j++) if (x[j] !== 0) dot += wk[j] * x[j];
      return dot;
    });
    const probs = this.softmax(logits);
    let bestIdx = 0;
    const scores: Partial<Record<ComplaintCategory, number>> = {};
    probs.forEach((p, k) => {
      scores[this.categories[k]] = parseFloat(p.toFixed(4));
      if (p > probs[bestIdx]) bestIdx = k;
    });
    return {
      category: this.categories[bestIdx],
      confidence: parseFloat(probs[bestIdx].toFixed(4)),
      scores,
    };
  }
}

const CRITICAL_KEYWORDS = [
  'fire', 'smoke', 'flooding', 'spark', 'electrocution', 'emergency', 'gas leak',
  'injury', 'blood', 'collapse', 'dangerous', 'unsafe',
];

const HIGH_KEYWORDS = [
  'no water', 'no electricity', 'leaking ceiling', 'cannot lock', 'broken glass',
  'entire floor', 'power cut',
];

function predictPriority(text: string, category: ComplaintCategory): PriorityPrediction {
  const lower = text.toLowerCase();
  if (CRITICAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { priority: 'CRITICAL', confidence: 0.9, reviewRequired: false };
  }
  if (HIGH_KEYWORDS.some((kw) => lower.includes(kw)) || category === 'MAINTENANCE') {
    return { priority: 'HIGH', confidence: 0.78, reviewRequired: false };
  }
  if (category === 'HOUSEKEEPING' || category === 'ROOM_SERVICE') {
    return { priority: 'MEDIUM', confidence: 0.72, reviewRequired: false };
  }
  if (category === 'LAUNDRY' || category === 'OTHER') {
    return { priority: 'LOW', confidence: 0.74, reviewRequired: false };
  }
  return { priority: 'MEDIUM', confidence: 0.5, reviewRequired: true };
}

const POSITIVE_WORDS = ['good', 'great', 'please', 'thank', 'appreciate', 'nice'];
const NEGATIVE_WORDS = ['bad', 'terrible', 'broken', 'dirty', 'leaking', 'not working', 'urgent', 'worst'];

function analyzeSentiment(text: string): SentimentPrediction {
  const lower = text.toLowerCase();
  let pos = 0, neg = 0;
  POSITIVE_WORDS.forEach((w) => { if (lower.includes(w)) pos++; });
  NEGATIVE_WORDS.forEach((w) => { if (lower.includes(w)) neg++; });
  const total = pos + neg || 1;
  if (neg > pos) return { sentiment: 'NEGATIVE', confidence: parseFloat((neg / total).toFixed(2)) };
  if (pos > neg) return { sentiment: 'POSITIVE', confidence: parseFloat((pos / total).toFixed(2)) };
  return { sentiment: 'NEUTRAL', confidence: 0.6 };
}

let classifierInstance: TfIdfLogisticClassifier | null = null;

function getClassifier(): TfIdfLogisticClassifier {
  if (!classifierInstance) {
    classifierInstance = new TfIdfLogisticClassifier();
    classifierInstance.train(TRAINING_DATA);
  }
  return classifierInstance;
}

export function classifyComplaint(title: string, description: string): FullPrediction {
  const text = `${title} ${description}`.trim();
  const classifier = getClassifier();
  const catResult = classifier.predict(text || 'other request');

  return {
    category: {
      category: catResult.category,
      confidence: catResult.confidence,
      reviewRequired: catResult.confidence < CONFIDENCE_THRESHOLD,
      allScores: catResult.scores,
    },
    priority: predictPriority(text, catResult.category),
    sentiment: analyzeSentiment(text),
    modelVersion: MODEL_VERSION,
  };
}

export const classifyServiceRequest = classifyComplaint;

export function getCategoryLabel(category: ComplaintCategory): string {
  const labels: Record<ComplaintCategory, string> = {
    HOUSEKEEPING: 'Housekeeping',
    ROOM_SERVICE: 'Room Service',
    MAINTENANCE: 'Maintenance',
    LAUNDRY: 'Laundry',
    OTHER: 'Other',
  };
  return labels[category] || category;
}
