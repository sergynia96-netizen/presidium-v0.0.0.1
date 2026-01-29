/**
 * Device Service - Device fingerprinting and binding
 */

import { DeviceFingerprint, DeviceComponents } from '../types/auth.types';
import { randomUUID } from 'crypto';

export class DeviceService {
  private static devices: Map<string, DeviceFingerprint> = new Map();
  private static phoneToDevices: Map<string, Set<string>> = new Map();

  /**
   * Verify device fingerprint
   * Returns device info with risk score
   */
  static async verifyDevice(
    fingerprint: string,
    components: DeviceComponents,
    phone?: string
  ): Promise<DeviceFingerprint> {
    let device = this.devices.get(fingerprint);

    // Create new device if not exists
    if (!device) {
      device = {
        id: randomUUID(),
        fingerprint,
        components,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        trusted: false,
        blocked: false,
        riskScore: 0
      };
      this.devices.set(fingerprint, device);
    } else {
      device.lastSeen = new Date().toISOString();
    }

    // If phone provided, check device history
    if (phone) {
      device.phone = phone;
      const userDevices = this.phoneToDevices.get(phone) || new Set();
      
      // First time device for this phone - higher risk
      if (!userDevices.has(fingerprint)) {
        device.riskScore += 30;
        userDevices.add(fingerprint);
        this.phoneToDevices.set(phone, userDevices);
      } else {
        // Known device - lower risk
        device.riskScore = Math.max(0, device.riskScore - 10);
      }

      // Check if device was previously blocked
      if (device.blocked) {
        device.riskScore = 100;
        return device;
      }
    }

    // Calculate risk based on components
    device.riskScore = this.calculateRiskScore(device, components);

    return device;
  }

  /**
   * Calculate device risk score based on components
   */
  private static calculateRiskScore(
    device: DeviceFingerprint,
    components: DeviceComponents
  ): number {
    let risk = device.riskScore || 0;

    // Missing or suspicious components
    if (!components.userAgent || components.userAgent.length < 10) {
      risk += 20;
    }
    if (!components.screenResolution) {
      risk += 15;
    }
    if (!components.timezone) {
      risk += 10;
    }

    // Suspicious user agent patterns
    if (components.userAgent) {
      const suspiciousPatterns = ['bot', 'crawler', 'spider', 'headless'];
      const lowerUA = components.userAgent.toLowerCase();
      if (suspiciousPatterns.some(pattern => lowerUA.includes(pattern))) {
        risk += 40;
      }
    }

    // Tor/VPN indicators (would need additional checks)
    // For now, assume low risk if components look normal

    return Math.min(100, risk);
  }

  /**
   * Trust device for user
   */
  static trustDevice(fingerprint: string, phone: string): void {
    const device = this.devices.get(fingerprint);
    if (device) {
      device.trusted = true;
      device.riskScore = 0;
      device.phone = phone;
      
      const userDevices = this.phoneToDevices.get(phone) || new Set();
      userDevices.add(fingerprint);
      this.phoneToDevices.set(phone, userDevices);
    }
  }

  /**
   * Block device
   */
  static blockDevice(fingerprint: string, reason: string): void {
    const device = this.devices.get(fingerprint);
    if (device) {
      device.blocked = true;
      device.riskScore = 100;
    }
  }

  /**
   * Get user devices
   */
  static getUserDevices(phone: string): DeviceFingerprint[] {
    const deviceFingerprints = this.phoneToDevices.get(phone) || new Set();
    return Array.from(deviceFingerprints)
      .map(fp => this.devices.get(fp))
      .filter((d): d is DeviceFingerprint => d !== undefined);
  }
}

