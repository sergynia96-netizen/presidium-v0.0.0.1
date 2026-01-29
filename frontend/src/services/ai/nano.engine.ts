/**
 * NanoEngine - ONNX Runtime CPU inference for low-end devices
 * Uses quantized TinyBERT for intent classification and sentiment analysis
 */

import * as ort from 'onnxruntime-web';

export type Intent = 'question' | 'statement' | 'greeting' | 'command' | 'spam' | 'urgent' | 'unknown';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface ClassificationResult {
  intent: Intent;
  sentiment: Sentiment;
  confidence: number;
  processingTimeMs: number;
}

export interface QuickReply {
  text: string;
  intent: Intent;
  priority: number;
}

export class NanoEngine {
  private static instance: NanoEngine;
  private session: ort.InferenceSession | null = null;
  private isInitialized = false;
  private isLoading = false;

  // Pre-defined quick replies for low-end devices
  private readonly quickReplies: Record<Intent, QuickReply[]> = {
    question: [
      { text: "Let me check that for you", intent: 'question', priority: 1 },
      { text: "I'll look into it", intent: 'question', priority: 2 },
      { text: "Good question! Let me find out", intent: 'question', priority: 3 },
    ],
    greeting: [
      { text: "Hello! How can I help?", intent: 'greeting', priority: 1 },
      { text: "Hi there! 👋", intent: 'greeting', priority: 2 },
      { text: "Welcome back!", intent: 'greeting', priority: 3 },
    ],
    command: [
      { text: "Processing your request...", intent: 'command', priority: 1 },
      { text: "On it!", intent: 'command', priority: 2 },
      { text: "Will do!", intent: 'command', priority: 3 },
    ],
    urgent: [
      { text: "I'll prioritize this", intent: 'urgent', priority: 1 },
      { text: "Handling urgently", intent: 'urgent', priority: 2 },
      { text: "On it right away!", intent: 'urgent', priority: 3 },
    ],
    spam: [
      { text: "Moved to junk", intent: 'spam', priority: 1 },
      { text: "Marked as spam", intent: 'spam', priority: 2 },
    ],
    statement: [
      { text: "Got it", intent: 'statement', priority: 1 },
      { text: "Understood", intent: 'statement', priority: 2 },
      { text: "Noted", intent: 'statement', priority: 3 },
    ],
    unknown: [
      { text: "I'm not sure I understand", intent: 'unknown', priority: 1 },
      { text: "Could you clarify?", intent: 'unknown', priority: 2 },
    ],
  };

  private constructor() {
    // Configure ONNX Runtime for CPU-only execution
    ort.env.wasm.numThreads = 1; // Single thread for low-end devices
    ort.env.wasm.simd = true; // Enable SIMD if available
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NanoEngine {
    if (!NanoEngine.instance) {
      NanoEngine.instance = new NanoEngine();
    }
    return NanoEngine.instance;
  }

  /**
   * Initialize ONNX model (lazy loading)
   * For now, uses heuristics. Real model loading can be added later.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isLoading) {
      return;
    }

    this.isLoading = true;
    console.log('🧠 Initializing NanoEngine (Heuristic Mode)...');

    try {
      // TODO: Load actual ONNX model when available
      // const modelUrl = '/models/tinybert-intent-q8.onnx';
      // this.session = await ort.InferenceSession.create(modelUrl, {
      //   executionProviders: ['wasm'],
      //   graphOptimizationLevel: 'all',
      // });

      // For now, use heuristic-based classification
      this.isInitialized = true;
      console.log('✅ NanoEngine initialized (Heuristic Mode)');
    } catch (error) {
      console.error('❌ Failed to initialize NanoEngine:', error);
      // Fallback to pure heuristics
      this.isInitialized = true;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Classify text intent and sentiment
   * Uses heuristic rules for now (can be replaced with ONNX model)
   * @param text - Input text
   * @returns ClassificationResult
   */
  async classifyText(text: string): Promise<ClassificationResult> {
    const startTime = performance.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Heuristic-based classification (fast, no model needed)
    const intent = this.classifyIntent(text);
    const sentiment = this.classifySentiment(text);
    const confidence = 0.75; // Heuristic confidence

    const processingTimeMs = performance.now() - startTime;

    return {
      intent,
      sentiment,
      confidence,
      processingTimeMs
    };
  }

  /**
   * Classify intent using heuristics
   * @param text - Input text
   * @returns Intent
   */
  private classifyIntent(text: string): Intent {
    const lower = text.toLowerCase().trim();

    // Greeting patterns
    if (/^(hi|hello|hey|greetings|good morning|good evening|привет)/i.test(lower)) {
      return 'greeting';
    }

    // Question patterns
    if (/\?$/.test(lower) || /^(what|when|where|who|why|how|can|could|would|is|are|do|does)/i.test(lower)) {
      return 'question';
    }

    // Command patterns
    if (/^(please|could you|can you|would you|run|execute|do|perform|start|stop)/i.test(lower)) {
      return 'command';
    }

    // Urgent patterns
    if (/\b(urgent|asap|emergency|critical|important|immediately)\b/i.test(lower)) {
      return 'urgent';
    }

    // Spam indicators
    if (/\b(click here|buy now|limited time|act now|winner|prize)\b/i.test(lower)) {
      return 'spam';
    }

    // Default to statement
    return 'statement';
  }

  /**
   * Classify sentiment using heuristics
   * @param text - Input text
   * @returns Sentiment
   */
  private classifySentiment(text: string): Sentiment {
    const lower = text.toLowerCase();

    // Positive keywords
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'love', 'happy', 'thanks', 'perfect', 'wonderful'];
    const positiveCount = positiveWords.filter(word => lower.includes(word)).length;

    // Negative keywords
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'angry', 'sad', 'disappointed', 'wrong', 'error'];
    const negativeCount = negativeWords.filter(word => lower.includes(word)).length;

    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    }

    return 'neutral';
  }

  /**
   * Get quick reply suggestions based on intent
   * @param intent - Detected intent
   * @param count - Number of suggestions (default: 3)
   * @returns Array of QuickReply
   */
  getQuickReplies(intent: Intent, count: number = 3): QuickReply[] {
    const replies = this.quickReplies[intent] || this.quickReplies.unknown;
    return replies.slice(0, count);
  }

  /**
   * Get best quick reply for intent
   * @param intent - Detected intent
   * @returns QuickReply
   */
  getBestReply(intent: Intent): QuickReply {
    const replies = this.quickReplies[intent] || this.quickReplies.unknown;
    return replies[0];
  }

  /**
   * Batch classify multiple texts
   * @param texts - Array of texts
   * @returns Array of ClassificationResult
   */
  async classifyBatch(texts: string[]): Promise<ClassificationResult[]> {
    // Process sequentially for low-end devices
    const results: ClassificationResult[] = [];
    for (const text of texts) {
      results.push(await this.classifyText(text));
    }
    return results;
  }

  /**
   * Check if engine is ready
   * @returns boolean
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get engine status
   * @returns object with status info
   */
  getStatus(): {
    initialized: boolean;
    loading: boolean;
    mode: string;
    quickReplyCount: number;
  } {
    return {
      initialized: this.isInitialized,
      loading: this.isLoading,
      mode: this.session ? 'ONNX' : 'Heuristic',
      quickReplyCount: Object.values(this.quickReplies).flat().length
    };
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.isInitialized = false;
  }
}

// Export singleton instance
export const nanoEngine = NanoEngine.getInstance();

