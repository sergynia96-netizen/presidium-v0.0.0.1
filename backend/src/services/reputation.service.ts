/**
 * Reputation Service - Manages user trust and reputation system
 */

import { Reputation } from '../types/system.types';

export class ReputationService {
  private static reputation: Reputation = {
    trust: 99.9,
    reputation: 984,
    uptime: 2592000, // ~30 days in seconds
    transactions: 247,
    rating: 4.8,
    lastUpdate: new Date().toISOString()
  };

  /**
   * Get reputation
   */
  static getReputation(): Reputation {
    // Simulate small changes
    const now = Date.now();
    const lastUpdate = new Date(this.reputation.lastUpdate).getTime();
    const timeDiff = (now - lastUpdate) / 1000; // seconds

    // Update uptime
    this.reputation.uptime += timeDiff;

    // Small random fluctuations in trust
    if (Math.random() > 0.95) {
      this.reputation.trust = Math.max(95, Math.min(100, 
        this.reputation.trust + (Math.random() - 0.5) * 0.1
      ));
    }

    this.reputation.lastUpdate = new Date().toISOString();

    return { ...this.reputation };
  }

  /**
   * Increase reputation
   */
  static increaseReputation(amount: number, reason?: string): void {
    this.reputation.reputation += amount;
    this.reputation.trust = Math.min(100, this.reputation.trust + 0.1);
    this.reputation.transactions++;
    this.reputation.lastUpdate = new Date().toISOString();
  }

  /**
   * Decrease reputation
   */
  static decreaseReputation(amount: number, reason?: string): void {
    this.reputation.reputation = Math.max(0, this.reputation.reputation - amount);
    this.reputation.trust = Math.max(0, this.reputation.trust - 1);
    this.reputation.lastUpdate = new Date().toISOString();
  }

  /**
   * Update rating
   */
  static updateRating(newRating: number): void {
    // Weighted average
    const totalRatings = this.reputation.transactions;
    this.reputation.rating = (this.reputation.rating * totalRatings + newRating) / (totalRatings + 1);
    this.reputation.transactions++;
    this.reputation.lastUpdate = new Date().toISOString();
  }

  /**
   * Get formatted uptime
   */
  static getFormattedUptime(): string {
    const days = Math.floor(this.reputation.uptime / 86400);
    const hours = Math.floor((this.reputation.uptime % 86400) / 3600);
    const minutes = Math.floor((this.reputation.uptime % 3600) / 60);
    return `${days}д ${hours}ч ${minutes}м`;
  }
}

