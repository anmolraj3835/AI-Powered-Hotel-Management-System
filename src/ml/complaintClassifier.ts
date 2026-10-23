import type {
  ComplaintCategory,
  ComplaintPriority,
  SentimentType,
} from '@/types/database';

export const CONFIDENCE_THRESHOLD = 0.65;
export const MODEL_VERSION = '3.1.0';

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

const CATEGORY_KEYWORDS: Record<ComplaintCategory, string[]> = {
  HOUSEKEEPING: ['clean', 'dust', 'sweep', 'mop', 'towel', 'bedsheet', 'pillow', 'linen', 'trash', 'garbage', 'smell', 'dirt', 'tidy', 'soap', 'shampoo'],
  ROOM_SERVICE: ['food', 'breakfast', 'dinner', 'lunch', 'coffee', 'tea', 'water bottle', 'snack', 'drink', 'menu', 'meal', 'tray', 'cutlery'],
  MAINTENANCE: ['ac', 'air conditioner', 'leak', 'tap', 'faucet', 'light', 'bulb', 'switch', 'wifi', 'internet', 'lock', 'door', 'fan', 'heater', 'geyser', 'drain', 'plumbing', 'shower', 'tv', 'remote', 'socket'],
  LAUNDRY: ['wash', 'iron', 'dry', 'clothes', 'press', 'detergent', 'suit', 'dress'],
  OTHER: ['noise', 'keycard', 'receipt', 'bill', 'extension', 'inquiry', 'general'],
};

const CRITICAL_KEYWORDS = ['fire', 'smoke', 'spark', 'shock', 'flood', 'gas', 'danger', 'emergency'];
const HIGH_KEYWORDS = ['no water', 'no power', 'lock broken', 'door jammed', 'ac not working', 'geyser not working'];

export function predictCategorySync(text: string): { category: ComplaintCategory; confidence: number; allScores: Partial<Record<ComplaintCategory, number>> } {
  const lower = text.toLowerCase();
  const scores: Partial<Record<ComplaintCategory, number>> = {};
  let bestCategory: ComplaintCategory = 'OTHER';
  let maxScore = 0;

  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [ComplaintCategory, string[]][]) {
    let matches = 0;
    for (const w of words) {
      if (lower.includes(w)) matches++;
    }
    const score = matches > 0 ? Math.min(0.5 + matches * 0.2, 0.95) : 0.1;
    scores[cat] = parseFloat(score.toFixed(2));
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat;
    }
  }

  const confidence = maxScore >= 0.5 ? maxScore : 0.6;
  return { category: bestCategory, confidence, allScores: scores };
}

export function classifyComplaint(title: string, description: string): FullPrediction {
  const text = `${title} ${description}`.trim();
  const lower = text.toLowerCase();
  const cat = predictCategorySync(text);

  let priority: ComplaintPriority = 'MEDIUM';
  if (CRITICAL_KEYWORDS.some((k) => lower.includes(k))) priority = 'CRITICAL';
  else if (HIGH_KEYWORDS.some((k) => lower.includes(k)) || cat.category === 'MAINTENANCE') priority = 'HIGH';
  else if (cat.category === 'HOUSEKEEPING' || cat.category === 'ROOM_SERVICE') priority = 'MEDIUM';
  else priority = 'LOW';

  const negativeWords = ['bad', 'broken', 'terrible', 'worst', 'urgent', 'dirty', 'leak', 'not working'];
  const positiveWords = ['good', 'please', 'thanks', 'kindly'];
  let negCount = 0;
  let posCount = 0;
  negativeWords.forEach(w => { if (lower.includes(w)) negCount++; });
  positiveWords.forEach(w => { if (lower.includes(w)) posCount++; });

  const sentiment: SentimentType = negCount > posCount ? 'NEGATIVE' : posCount > negCount ? 'POSITIVE' : 'NEUTRAL';

  return {
    category: {
      category: cat.category,
      confidence: cat.confidence,
      reviewRequired: cat.confidence < CONFIDENCE_THRESHOLD,
      allScores: cat.allScores,
    },
    priority: {
      priority,
      confidence: 0.85,
      reviewRequired: false,
    },
    sentiment: {
      sentiment,
      confidence: 0.8,
    },
    modelVersion: MODEL_VERSION,
  };
}

export async function classifyComplaintAsync(title: string, description: string): Promise<FullPrediction> {
  return classifyComplaint(title, description);
}

export const classifyServiceRequest = classifyComplaintAsync;

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
