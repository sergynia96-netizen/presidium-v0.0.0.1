/**
 * AssistantService - Autonomous AI assistant with adaptive intelligence
 * Routes to appropriate AI engine based on device capability
 */

import { deviceCapability, type DeviceTier } from './capability.service';
import { nanoEngine, type Intent, type ClassificationResult, type QuickReply } from './nano.engine';
import { nanoCensor, type SafetyCheck } from './nano.censor';

export interface AssistantResponse {
  quickReplies: QuickReply[];
  classification: ClassificationResult;
  safety: SafetyCheck;
  action?: 'suggest' | 'auto-reply' | 'flag-spam' | 'none';
  processingTimeMs: number;
}

export interface AssistantConfig {
  enableAutoReply: boolean;
  enableSpamFilter: boolean;
  enableQuickReplies: boolean;
  maxQuickReplies: number;
}

export class AssistantService {
  private static instance: AssistantService;
  private deviceTier: DeviceTier | null = null;
  private isInitialized = false;

  private config: AssistantConfig = {
    enableAutoReply: false, // Disabled by default for safety
    enableSpamFilter: true,
    enableQuickReplies: true,
    maxQuickReplies: 3
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AssistantService {
    if (!AssistantService.instance) {
      AssistantService.instance = new AssistantService();
    }
    return AssistantService.instance;
  }

  /**
   * Initialize assistant with device assessment
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🤖 Initializing AssistantService...');

    // Assess device capability
    const profile = deviceCapability.assessHardware();
    this.deviceTier = profile.tier;

    // Initialize NanoEngine
    await nanoEngine.initialize();

    this.isInitialized = true;
    console.log(`✅ AssistantService initialized for ${this.deviceTier} tier device`);
  }

  /**
   * Process incoming message with full AI pipeline
   * @param text - Message text
   * @returns AssistantResponse with suggestions and actions
   */
  async processMessage(text: string): Promise<AssistantResponse> {
    const startTime = performance.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Step 1: Safety check (must be fast)
    const safety = nanoCensor.checkSafety(text);

    // Step 2: Classify intent and sentiment
    const classification = await nanoEngine.classifyText(text);

    // Step 3: Generate quick replies based on device tier
    let quickReplies: QuickReply[] = [];
    let action: AssistantResponse['action'] = 'none';

    if (this.deviceTier === 'LOW') {
      // Low-end device: Use lightweight heuristics
      quickReplies = this.handleLowEndDevice(classification, safety);
      action = this.determineAction(classification, safety, 'LOW');
    } else if (this.deviceTier === 'MID') {
      // Mid-range device: Use NanoEngine
      quickReplies = nanoEngine.getQuickReplies(
        classification.intent,
        this.config.maxQuickReplies
      );
      action = this.determineAction(classification, safety, 'MID');
    } else {
      // High-end device: Full AI capabilities
      quickReplies = nanoEngine.getQuickReplies(
        classification.intent,
        this.config.maxQuickReplies
      );
      action = this.determineAction(classification, safety, 'HIGH');
    }

    const processingTimeMs = performance.now() - startTime;

    return {
      quickReplies,
      classification,
      safety,
      action,
      processingTimeMs
    };
  }

  /**
   * Handle message processing for low-end devices
   * @param classification - Classification result
   * @param safety - Safety check result
   * @returns Array of QuickReply
   */
  private handleLowEndDevice(
    classification: ClassificationResult,
    safety: SafetyCheck
  ): QuickReply[] {
    // For low-end devices, use minimal processing
    if (!safety.safe) {
      return []; // No suggestions for unsafe messages
    }

    // Return top 2 quick replies (less memory)
    return nanoEngine.getQuickReplies(classification.intent, 2);
  }

  /**
   * Determine action based on classification and safety
   * @param classification - Classification result
   * @param safety - Safety check result
   * @param tier - Device tier
   * @returns Action to take
   */
  private determineAction(
    classification: ClassificationResult,
    safety: SafetyCheck,
    tier: DeviceTier
  ): AssistantResponse['action'] {
    // Spam detection
    if (!safety.safe || classification.intent === 'spam') {
      if (this.config.enableSpamFilter) {
        return 'flag-spam';
      }
    }

    // Question detection
    if (classification.intent === 'question' && this.config.enableQuickReplies) {
      return 'suggest';
    }

    // Auto-reply for greetings (if enabled)
    if (classification.intent === 'greeting' && this.config.enableAutoReply) {
      return 'auto-reply';
    }

    return 'none';
  }

  /**
   * Get smart suggestions for current message
   * @param text - Message text
   * @returns Array of suggestion strings
   */
  async getSmartSuggestions(text: string): Promise<string[]> {
    const response = await this.processMessage(text);
    return response.quickReplies.map(reply => reply.text);
  }

  /**
   * Check if message should be auto-filtered
   * @param text - Message text
   * @returns boolean
   */
  async shouldFilter(text: string): Promise<boolean> {
    const safety = nanoCensor.checkSafety(text);
    return !safety.safe && this.config.enableSpamFilter;
  }

  /**
   * Update assistant configuration
   * @param config - Partial config to update
   */
  updateConfig(config: Partial<AssistantConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 Assistant config updated:', this.config);
  }

  /**
   * Get current configuration
   * @returns AssistantConfig
   */
  getConfig(): AssistantConfig {
    return { ...this.config };
  }

  /**
   * Get assistant status
   * @returns object with status info
   */
  getStatus(): {
    initialized: boolean;
    deviceTier: DeviceTier | null;
    config: AssistantConfig;
    engineStatus: any;
  } {
    return {
      initialized: this.isInitialized,
      deviceTier: this.deviceTier,
      config: this.config,
      engineStatus: nanoEngine.getStatus()
    };
  }

  /**
   * Batch process multiple messages
   * @param messages - Array of message texts
   * @returns Array of AssistantResponse
   */
  async processBatch(messages: string[]): Promise<AssistantResponse[]> {
    const results: AssistantResponse[] = [];
    
    // Process sequentially for low-end devices
    for (const message of messages) {
      results.push(await this.processMessage(message));
    }

    return results;
  }

  /**
   * Get device tier emoji and name
   * @returns object with emoji and name
   */
  getDeviceInfo(): { emoji: string; name: string; tier: DeviceTier | null } {
    return {
      emoji: deviceCapability.getTierEmoji(),
      name: deviceCapability.getTierName(),
      tier: this.deviceTier
    };
  }

  /**
   * Reset assistant state
   */
  reset(): void {
    this.isInitialized = false;
    this.deviceTier = null;
    this.config = {
      enableAutoReply: false,
      enableSpamFilter: true,
      enableQuickReplies: true,
      maxQuickReplies: 3
    };
  }
}

// Export singleton instance
export const assistantService = AssistantService.getInstance();

