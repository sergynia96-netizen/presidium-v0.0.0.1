/**
 * Security Event Service - Logging and monitoring
 */

import { SecurityEvent } from '../types/auth.types';
import { randomUUID } from 'crypto';

export class SecurityEventService {
  private static events: SecurityEvent[] = [];
  private static readonly MAX_EVENTS = 1000;

  /**
   * Log security event
   */
  static async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.events.unshift(fullEvent);

    // Keep only last MAX_EVENTS
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(0, this.MAX_EVENTS);
    }

    // Log to console (in production: send to monitoring system)
    console.log(`🔒 [SECURITY] ${event.severity.toUpperCase()}: ${event.type} - ${event.description}`);
    
    if (event.severity === 'critical' || event.severity === 'high') {
      console.error(`🚨 Alert: ${event.description}`, {
        userId: event.userId,
        phone: event.phone,
        deviceFingerprint: event.deviceFingerprint,
        ipAddress: event.ipAddress
      });
    }
  }

  /**
   * Get recent security events
   */
  static getEvents(limit = 50, severity?: SecurityEvent['severity']): SecurityEvent[] {
    let events = this.events;
    
    if (severity) {
      events = events.filter(e => e.severity === severity);
    }

    return events.slice(0, limit);
  }

  /**
   * Get unresolved events
   */
  static getUnresolvedEvents(): SecurityEvent[] {
    return this.events.filter(e => !e.resolved);
  }

  /**
   * Resolve event
   */
  static resolveEvent(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
      return true;
    }
    return false;
  }
}

