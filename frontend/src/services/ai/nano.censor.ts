/**
 * NanoCensor - Ultra-fast spam/scam detection
 * Uses Regex + Bloom Filter for <10ms performance on any device
 */

export interface SafetyCheck {
  safe: boolean;
  reason: string;
  confidence: number; // 0-1
  flags: string[];
}

export class NanoCensor {
  private static instance: NanoCensor;
  
  // Regex patterns for common spam/scam indicators
  private readonly spamPatterns = [
    /\b(viagra|cialis|pharmacy)\b/i,
    /\b(click here|act now|limited time)\b/i,
    /\b(winner|congratulations|prize)\b/i,
    /\b(nigerian prince|inheritance|lottery)\b/i,
    /\b(bitcoin|crypto|investment opportunity)\b/i,
    /\b(password|verify account|suspended)\b/i,
    /\b(free money|get rich|work from home)\b/i,
  ];

  // Scam keywords for bloom filter simulation
  private readonly scamKeywords = new Set([
    'verify', 'suspended', 'urgent', 'click', 'prize',
    'winner', 'congratulations', 'inheritance', 'lottery',
    'bitcoin', 'crypto', 'investment', 'password', 'account',
    'viagra', 'cialis', 'pharmacy', 'free', 'money', 'rich'
  ]);

  // Suspicious patterns
  private readonly suspiciousPatterns = [
    /(.)\1{4,}/i, // Repeated characters (aaaaa)
    /[A-Z]{10,}/, // Too many capitals
    /\$\d+[,\d]*\d+/, // Money amounts
    /https?:\/\/bit\.ly/i, // Shortened URLs
    /https?:\/\/[^\s]{50,}/, // Very long URLs
  ];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): NanoCensor {
    if (!NanoCensor.instance) {
      NanoCensor.instance = new NanoCensor();
    }
    return NanoCensor.instance;
  }

  /**
   * Check message safety (< 10ms target)
   * @param text - Message text to check
   * @returns SafetyCheck result
   */
  checkSafety(text: string): SafetyCheck {
    const startTime = performance.now();
    const flags: string[] = [];
    let confidence = 1.0;

    // Quick length check
    if (text.length === 0) {
      return {
        safe: true,
        reason: 'Empty message',
        confidence: 1.0,
        flags: []
      };
    }

    // Check for spam patterns (fast regex)
    for (const pattern of this.spamPatterns) {
      if (pattern.test(text)) {
        flags.push('spam-pattern');
        confidence -= 0.3;
        break;
      }
    }

    // Bloom filter check (O(1) lookup)
    const words = text.toLowerCase().split(/\s+/);
    let scamWordCount = 0;
    for (const word of words) {
      if (this.scamKeywords.has(word)) {
        scamWordCount++;
      }
    }

    if (scamWordCount >= 2) {
      flags.push('scam-keywords');
      confidence -= 0.4;
    }

    // Check suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        flags.push('suspicious-pattern');
        confidence -= 0.2;
        break;
      }
    }

    // Check for excessive links
    const linkCount = (text.match(/https?:\/\//gi) || []).length;
    if (linkCount > 3) {
      flags.push('excessive-links');
      confidence -= 0.3;
    }

    // Check for excessive emojis (potential spam)
    const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
    if (emojiCount > 10) {
      flags.push('emoji-spam');
      confidence -= 0.2;
    }

    // Determine safety
    const safe = confidence > 0.5;
    const reason = safe 
      ? 'Message appears safe'
      : `Potential ${flags.join(', ')} detected`;

    const elapsed = performance.now() - startTime;
    
    if (elapsed > 10) {
      console.warn(`⚠️ NanoCensor took ${elapsed.toFixed(2)}ms (target: <10ms)`);
    }

    return {
      safe,
      reason,
      confidence: Math.max(0, Math.min(1, confidence)),
      flags
    };
  }

  /**
   * Batch check multiple messages
   * @param messages - Array of message texts
   * @returns Array of SafetyCheck results
   */
  checkBatch(messages: string[]): SafetyCheck[] {
    return messages.map(msg => this.checkSafety(msg));
  }

  /**
   * Check if text contains profanity (basic filter)
   * @param text - Text to check
   * @returns boolean
   */
  containsProfanity(text: string): boolean {
    const profanityList = [
      'fuck', 'shit', 'damn', 'bitch', 'asshole',
      // Add more as needed, or use external library
    ];

    const lowerText = text.toLowerCase();
    return profanityList.some(word => lowerText.includes(word));
  }

  /**
   * Get performance stats
   * @returns object with stats
   */
  getStats(): {
    spamPatternCount: number;
    scamKeywordCount: number;
    suspiciousPatternCount: number;
  } {
    return {
      spamPatternCount: this.spamPatterns.length,
      scamKeywordCount: this.scamKeywords.size,
      suspiciousPatternCount: this.suspiciousPatterns.length
    };
  }
}

// Export singleton instance
export const nanoCensor = NanoCensor.getInstance();

