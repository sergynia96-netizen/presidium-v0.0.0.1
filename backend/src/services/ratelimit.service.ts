/**
 * Rate Limit Service - Request throttling and bot protection
 */

import { RateLimit } from '../types/auth.types';

export class RateLimitService {
  private static limits: Map<string, RateLimit> = new Map();

  // Rate limit configurations
  private static readonly CONFIGS = {
    otp_request: { maxRequests: 3, windowMs: 60 * 1000 }, // 3 per minute
    otp_verify: { maxRequests: 5, windowMs: 5 * 60 * 1000 }, // 5 per 5 minutes
    login_attempt: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
    api_call: { maxRequests: 100, windowMs: 60 * 1000 } // 100 per minute
  };

  /**
   * Check if request is rate limited
   */
  static async checkRateLimit(
    key: string,
    type: RateLimit['type']
  ): Promise<RateLimit> {
    const limitKey = `${type}:${key}`;
    const config = this.CONFIGS[type];
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let limit = this.limits.get(limitKey);

    // Create new limit or reset if window expired
    if (!limit || new Date(limit.windowStart).getTime() < windowStart) {
      limit = {
        key,
        type,
        count: 0,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(now + config.windowMs).toISOString(),
        blocked: false
      };
      this.limits.set(limitKey, limit);
    }

    // Check if blocked
    if (limit.blocked && limit.blockedUntil) {
      if (new Date(limit.blockedUntil) > new Date()) {
        return limit;
      } else {
        // Unblock if time passed
        limit.blocked = false;
        limit.blockedUntil = undefined;
        limit.count = 0;
      }
    }

    // Check if exceeded limit
    if (limit.count >= config.maxRequests) {
      limit.blocked = true;
      limit.blockedUntil = new Date(now + config.windowMs * 2).toISOString();
      return limit;
    }

    return limit;
  }

  /**
   * Record request attempt
   */
  static async recordRequest(
    key: string,
    type: RateLimit['type'],
    success = true
  ): Promise<void> {
    const limitKey = `${type}:${key}`;
    const limit = this.limits.get(limitKey);

    if (limit) {
      limit.count++;
      limit.windowStart = new Date(Date.now() - this.CONFIGS[type].windowMs).toISOString();
      limit.windowEnd = new Date(Date.now() + this.CONFIGS[type].windowMs).toISOString();

      // If failed multiple times, extend block time
      if (!success && limit.count >= this.CONFIGS[type].maxRequests) {
        limit.blocked = true;
        limit.blockedUntil = new Date(Date.now() + this.CONFIGS[type].windowMs * 5).toISOString();
      }
    }
  }

  /**
   * Clear rate limit for key
   */
  static clearLimit(key: string, type: RateLimit['type']): void {
    const limitKey = `${type}:${key}`;
    this.limits.delete(limitKey);
  }
}

