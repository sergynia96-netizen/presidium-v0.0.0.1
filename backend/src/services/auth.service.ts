/**
 * Authentication Service - Multi-factor authentication with SMS-OTP + Device Binding
 * Implements enterprise-grade authentication with behavioral analysis
 */

import { 
  AuthRequest, 
  AuthResponse, 
  VerifyOTPRequest, 
  VerifyOTPResponse,
  AuthSession,
  DeviceFingerprint,
  SMSOTP,
  RateLimit,
  SecurityEvent,
  MFAType,
  MFAFactor
} from '../types/auth.types';
import { randomUUID } from 'crypto';
import { DeviceService } from './device.service';
import { RateLimitService } from './ratelimit.service';
import { BehavioralService } from './behavioral.service';
import { SecurityEventService } from './security.service';

export class AuthService {
  private static sessions: Map<string, AuthSession> = new Map();
  private static otps: Map<string, SMSOTP> = new Map();
  private static phoneToUserId: Map<string, string> = new Map(); // Mock user mapping

  /**
   * Initiate authentication flow
   * Step 1: Phone binding + Device fingerprinting + Behavioral analysis
   */
  static async initiateAuth(request: AuthRequest): Promise<AuthResponse> {
    const {
      phone,
      deviceFingerprint,
      deviceComponents,
      ipAddress,
      userAgent,
      typingPattern,
      captchaToken
    } = request;

    // 1. Rate limiting check
    const rateLimitCheck = await RateLimitService.checkRateLimit(phone, 'otp_request');
    if (rateLimitCheck.blocked) {
      await SecurityEventService.logEvent({
        type: 'rate_limit_exceeded',
        phone,
        deviceFingerprint,
        ipAddress,
        severity: 'medium',
        description: `OTP request rate limit exceeded for ${phone}`
      });
      return {
        success: false,
        requiresOTP: false,
        otpSent: false,
        requiresMFA: false,
        riskScore: 100,
        blocked: true,
        message: 'Too many requests. Please try again later.'
      };
    }

    // 2. Device fingerprinting
    const device = await DeviceService.verifyDevice(deviceFingerprint, deviceComponents, phone);
    const deviceRiskScore = device.riskScore;

    // 3. Behavioral analysis
    let behavioralRiskScore = 0;
    if (typingPattern) {
      const behavioral = await BehavioralService.analyzeTyping(phone, typingPattern);
      behavioralRiskScore = behavioral.riskScore;
    }

    // 4. Calculate combined risk score
    const riskScore = Math.max(deviceRiskScore, behavioralRiskScore);
    const blocked = riskScore >= 80 || device.blocked;

    if (blocked) {
      await SecurityEventService.logEvent({
        type: 'suspicious_activity',
        phone,
        deviceFingerprint,
        ipAddress,
        severity: 'high',
        description: `High risk authentication attempt blocked (risk: ${riskScore})`
      });
      return {
        success: false,
        requiresOTP: false,
        otpSent: false,
        requiresMFA: false,
        riskScore,
        blocked: true,
        message: 'Authentication blocked due to security risk.'
      };
    }

    // 5. Generate and send SMS OTP
    const otp = await this.generateOTP(phone, deviceFingerprint, ipAddress, 'login');
    
    // In production: Send SMS via adapter
    // await SMSAdapter.sendOTP(phone, otp.code);
    console.log(`📱 [MOCK] SMS OTP for ${phone}: ${otp.code}`);

    // 6. Record OTP request
    await RateLimitService.recordRequest(phone, 'otp_request');

    return {
      success: true,
      requiresOTP: true,
      otpSent: true,
      otpId: otp.id,
      requiresMFA: riskScore >= 50, // Medium risk requires additional MFA
      mfaFactors: riskScore >= 50 ? await this.getAvailableMFAs(phone) : undefined,
      riskScore,
      blocked: false,
      nextStep: 'verify_otp'
    };
  }

  /**
   * Verify SMS OTP
   * Step 2: OTP verification + Session creation
   */
  static async verifyOTP(request: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    const { otpId, code, phone, deviceFingerprint, ipAddress } = request;

    // 1. Find OTP
    const otp = this.otps.get(otpId);
    if (!otp || otp.phone !== phone) {
      await SecurityEventService.logEvent({
        type: 'failed_login',
        phone,
        deviceFingerprint,
        ipAddress,
        severity: 'medium',
        description: `Invalid OTP attempt for ${phone}`
      });
      return {
        success: false,
        requiresMFA: false,
        blocked: false,
        message: 'Invalid OTP code.'
      };
    }

    // 2. Check expiration
    if (new Date(otp.expiresAt) < new Date()) {
      await RateLimitService.recordRequest(phone, 'otp_verify', false);
      return {
        success: false,
        requiresMFA: false,
        blocked: false,
        message: 'OTP code expired. Please request a new one.'
      };
    }

    // 3. Check attempts
    if (otp.attempts >= otp.maxAttempts) {
      await SecurityEventService.logEvent({
        type: 'failed_login',
        phone,
        deviceFingerprint,
        ipAddress,
        severity: 'high',
        description: `OTP max attempts exceeded for ${phone}`
      });
      return {
        success: false,
        requiresMFA: false,
        blocked: true,
        message: 'Maximum attempts exceeded. Please request a new OTP.'
      };
    }

    // 4. Rate limiting for verify
    const rateLimit = await RateLimitService.checkRateLimit(phone, 'otp_verify');
    if (rateLimit.blocked) {
      return {
        success: false,
        requiresMFA: false,
        blocked: true,
        message: 'Too many verification attempts. Please try again later.'
      };
    }

    // 5. Verify code
    if (otp.code !== code) {
      otp.attempts++;
      await RateLimitService.recordRequest(phone, 'otp_verify', false);
      return {
        success: false,
        requiresMFA: false,
        blocked: false,
        message: 'Invalid OTP code. Attempts remaining: ' + (otp.maxAttempts - otp.attempts)
      };
    }

    // 6. OTP verified - mark as used
    otp.verified = true;
    this.otps.delete(otpId);

    // 7. Get or create user ID
    let userId = this.phoneToUserId.get(phone);
    if (!userId) {
      userId = randomUUID();
      this.phoneToUserId.set(phone, userId);
    }

    // 8. Create session
    const session = await this.createSession(userId, phone, deviceFingerprint, ipAddress);

    await RateLimitService.recordRequest(phone, 'otp_verify', true);
    await SecurityEventService.logEvent({
      type: 'failed_login', // Will be resolved
      userId,
      phone,
      deviceFingerprint,
      ipAddress,
      severity: 'low',
      description: `Successful authentication for ${phone}`
    });

    return {
      success: true,
      sessionId: session.id,
      token: session.id, // In production: JWT token
      expiresAt: session.expiresAt,
      requiresMFA: false, // Already passed OTP
      blocked: false
    };
  }

  /**
   * Generate SMS OTP
   */
  private static async generateOTP(
    phone: string,
    deviceFingerprint: string,
    ipAddress: string,
    purpose: SMSOTP['purpose']
  ): Promise<SMSOTP> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const otp: SMSOTP = {
      id: randomUUID(),
      phone,
      code,
      expiresAt: new Date(Date.now() + 90000).toISOString(), // 90 seconds
      attempts: 0,
      maxAttempts: 3,
      verified: false,
      deviceFingerprint,
      ipAddress,
      purpose
    };

    this.otps.set(otp.id, otp);

    // Clean up expired OTPs
    setTimeout(() => {
      this.otps.delete(otp.id);
    }, 90000);

    return otp;
  }

  /**
   * Create authentication session
   */
  private static async createSession(
    userId: string,
    phone: string,
    deviceFingerprint: string,
    ipAddress: string
  ): Promise<AuthSession> {
    const session: AuthSession = {
      id: randomUUID(),
      userId,
      phone,
      deviceFingerprint,
      ipAddress,
      userAgent: '', // From request
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      lastActivity: new Date().toISOString(),
      status: 'active',
      mfaVerified: true
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get available MFA factors for user
   */
  private static async getAvailableMFAs(phone: string): Promise<MFAFactor[]> {
    // In production: Check what MFA factors user has configured
    return [
      { type: 'sms', enabled: true, configured: true },
      { type: 'totp', enabled: false, configured: false },
      { type: 'biometric', enabled: false, configured: false },
      { type: 'webauthn', enabled: false, configured: false }
    ];
  }

  /**
   * Verify session
   */
  static verifySession(sessionId: string): AuthSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return null;
    }
    if (new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
      return null;
    }
    session.lastActivity = new Date().toISOString();
    return session;
  }

  /**
   * Revoke session
   */
  static revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'revoked';
      return true;
    }
    return false;
  }
}

