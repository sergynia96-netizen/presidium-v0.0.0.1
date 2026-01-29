/**
 * Behavioral Service - Typing pattern analysis and velocity checks
 */

import { TypingPattern, BehavioralProfile, VelocityCheck } from '../types/auth.types';
import { randomUUID } from 'crypto';

export class BehavioralService {
  private static profiles: Map<string, BehavioralProfile> = new Map();
  private static velocityChecks: Map<string, VelocityCheck> = new Map();

  /**
   * Analyze typing pattern
   * Returns risk score based on typing entropy and consistency
   */
  static async analyzeTyping(
    phone: string,
    pattern: TypingPattern
  ): Promise<{ riskScore: number; profile: BehavioralProfile | null }> {
    let profile = this.profiles.get(phone);

    // Calculate typing metrics
    const avgSpeed = this.calculateAverageSpeed(pattern.timings);
    const consistency = this.calculateConsistency(pattern.timings);
    const entropy = this.calculateEntropy(pattern.timings);

    // Update pattern
    pattern.averageSpeed = avgSpeed;
    pattern.consistency = consistency;
    pattern.entropy = entropy;

    // If no profile, create new
    if (!profile) {
      profile = {
        userId: randomUUID(),
        typingPatterns: [pattern],
        averageTypingSpeed: avgSpeed,
        deviceId: '',
        sessionPatterns: {
          typicalStartTime: '',
          typicalDuration: 0,
          typicalDays: []
        },
        riskScore: 50 // Default risk for new user
      };
      this.profiles.set(phone, profile);
      return { riskScore: 50, profile: profile };
    }

    // Compare with historical patterns
    const historicalAvgSpeed = profile.averageTypingSpeed;
    const speedDeviation = Math.abs(avgSpeed - historicalAvgSpeed) / historicalAvgSpeed;
    
    let riskScore = profile.riskScore || 0;

    // High speed deviation (bot or different person)
    if (speedDeviation > 0.5) {
      riskScore += 30;
    } else if (speedDeviation > 0.3) {
      riskScore += 15;
    }

    // Low entropy (too consistent - might be automated)
    if (entropy < 2.0) {
      riskScore += 20;
    }

    // Very high speed (likely bot)
    if (avgSpeed > 200) { // > 200 WPM is suspicious
      riskScore += 40;
    }

    // Very low speed (might be copy-paste or bot)
    if (avgSpeed < 10) {
      riskScore += 15;
    }

    // Update profile
    profile.typingPatterns.push(pattern);
    if (profile.typingPatterns.length > 10) {
      profile.typingPatterns.shift(); // Keep last 10
    }
    profile.averageTypingSpeed = 
      (profile.averageTypingSpeed * 0.7) + (avgSpeed * 0.3); // Weighted average
    profile.riskScore = Math.min(100, riskScore);

    return { riskScore: profile.riskScore, profile: profile };
  }

  /**
   * Calculate average typing speed (WPM)
   */
  private static calculateAverageSpeed(timings: number[]): number {
    if (timings.length === 0) return 0;
    const avgInterval = timings.reduce((a, b) => a + b, 0) / timings.length;
    // WPM = (60 seconds / average interval in seconds) * 5 (average word length)
    return (60 / (avgInterval / 1000)) * 5;
  }

  /**
   * Calculate typing consistency (coefficient of variation)
   */
  private static calculateConsistency(timings: number[]): number {
    if (timings.length < 2) return 1.0;
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    return mean > 0 ? stdDev / mean : 1.0; // Coefficient of variation
  }

  /**
   * Calculate typing entropy (randomness measure)
   */
  private static calculateEntropy(timings: number[]): number {
    if (timings.length === 0) return 0;
    
    // Normalize timings to buckets
    const buckets = new Map<number, number>();
    const bucketSize = 50; // 50ms buckets
    
    timings.forEach(t => {
      const bucket = Math.floor(t / bucketSize) * bucketSize;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    });

    // Calculate Shannon entropy
    const total = timings.length;
    let entropy = 0;
    
    buckets.forEach(count => {
      const p = count / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    });

    return entropy;
  }

  /**
   * Check velocity (request frequency)
   */
  static checkVelocity(key: string, windowMs = 60000): VelocityCheck {
    let check = this.velocityChecks.get(key);
    const now = Date.now();

    if (!check || now - new Date(check.windowStart).getTime() > windowMs) {
      check = {
        requestCount: 0,
        windowStart: new Date(now - windowMs).toISOString(),
        windowEnd: new Date(now + windowMs).toISOString(),
        lastRequest: new Date().toISOString(),
        blocked: false
      };
    }

    check.requestCount++;
    check.lastRequest = new Date().toISOString();

    // Block if too many requests
    if (check.requestCount > 10) {
      check.blocked = true;
    }

    this.velocityChecks.set(key, check);
    return check;
  }
}

