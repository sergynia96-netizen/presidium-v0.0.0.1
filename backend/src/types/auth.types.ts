/**
 * Authentication Types - Multi-factor authentication system
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface AuthSession {
  id: string;
  userId: string;
  phone: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  lastActivity: string;
  status: 'active' | 'expired' | 'revoked';
  mfaVerified: boolean;
}

export interface SMSOTP {
  id: string;
  phone: string;
  code: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  deviceFingerprint?: string;
  ipAddress?: string;
  purpose: 'login' | 'registration' | 'transaction' | 'password_reset';
}

// ============================================================================
// DEVICE FINGERPRINTING
// ============================================================================

export interface DeviceFingerprint {
  id: string;
  userId?: string;
  phone?: string;
  fingerprint: string;
  components: DeviceComponents;
  createdAt: string;
  lastSeen: string;
  trusted: boolean;
  blocked: boolean;
  riskScore: number; // 0-100
}

export interface DeviceComponents {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  canvasFingerprint?: string;
  webglFingerprint?: string;
  audioFingerprint?: string;
}

// ============================================================================
// BEHAVIORAL ANALYSIS
// ============================================================================

export interface TypingPattern {
  timings: number[]; // Key press intervals in ms
  entropy: number; // Typing entropy (randomness)
  averageSpeed: number; // WPM
  consistency: number; // Variation coefficient
}

export interface VelocityCheck {
  requestCount: number;
  windowStart: string;
  windowEnd: string;
  lastRequest: string;
  blocked: boolean;
}

export interface BehavioralProfile {
  userId: string;
  typingPatterns: TypingPattern[];
  averageTypingSpeed: number;
  deviceId: string;
  geolocationPatterns?: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
  }[];
  sessionPatterns: {
    typicalStartTime: string;
    typicalDuration: number;
    typicalDays: string[];
  };
  riskScore: number;
}

// ============================================================================
// MFA FACTORS
// ============================================================================

export type MFAType = 'sms' | 'totp' | 'biometric' | 'webauthn' | 'push' | 'hardware';

export interface MFAFactor {
  type: MFAType;
  enabled: boolean;
  configured: boolean;
  lastUsed?: string;
  metadata?: Record<string, any>;
}

export interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName: string;
  createdAt: string;
  lastUsed?: string;
}

// ============================================================================
// AUTHENTICATION FLOW
// ============================================================================

export interface AuthRequest {
  phone: string;
  deviceFingerprint: string;
  deviceComponents: DeviceComponents;
  ipAddress: string;
  userAgent: string;
  typingPattern?: TypingPattern;
  captchaToken?: string;
}

export interface AuthResponse {
  success: boolean;
  sessionId?: string;
  requiresOTP: boolean;
  otpSent: boolean;
  otpId?: string;
  requiresMFA: boolean;
  mfaFactors?: MFAFactor[];
  riskScore: number;
  blocked: boolean;
  message?: string;
  nextStep?: 'verify_otp' | 'verify_mfa' | 'complete';
}

export interface VerifyOTPRequest {
  otpId: string;
  code: string;
  phone: string;
  deviceFingerprint: string;
  ipAddress: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  sessionId?: string;
  token?: string;
  expiresAt?: string;
  requiresMFA: boolean;
  mfaFactors?: MFAFactor[];
  blocked: boolean;
  message?: string;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimit {
  key: string; // phone, ip, fingerprint, etc.
  type: 'otp_request' | 'otp_verify' | 'login_attempt' | 'api_call';
  count: number;
  windowStart: string;
  windowEnd: string;
  blocked: boolean;
  blockedUntil?: string;
}

// ============================================================================
// SECURITY EVENTS
// ============================================================================

export interface SecurityEvent {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'device_change' | 'location_change' | 'rate_limit_exceeded';
  userId?: string;
  phone?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  resolved: boolean;
}

