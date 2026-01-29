/**
 * DeviceCapability - Hardware assessment for adaptive AI
 * Detects device tier to optimize AI workload
 */

export type DeviceTier = 'LOW' | 'MID' | 'HIGH';

export interface HardwareProfile {
  tier: DeviceTier;
  cpuCores: number;
  memoryGB: number;
  isLowEnd: boolean;
  canRunONNX: boolean;
  recommendedModelSize: number; // MB
}

export class DeviceCapability {
  private static instance: DeviceCapability;
  private profile: HardwareProfile | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DeviceCapability {
    if (!DeviceCapability.instance) {
      DeviceCapability.instance = new DeviceCapability();
    }
    return DeviceCapability.instance;
  }

  /**
   * Assess hardware capabilities
   * @returns HardwareProfile with device tier and specs
   */
  assessHardware(): HardwareProfile {
    if (this.profile) {
      return this.profile;
    }

    // Get CPU cores (fallback to 2 if unavailable)
    const cpuCores = navigator.hardwareConcurrency || 2;

    // Get device memory in GB (fallback to 2GB if unavailable)
    // @ts-ignore - deviceMemory is experimental
    const memoryGB = (navigator.deviceMemory as number) || 2;

    // Determine device tier based on hardware
    let tier: DeviceTier;
    let recommendedModelSize: number;

    if (cpuCores <= 2 && memoryGB <= 2) {
      // Potato device: 1-2 cores, ≤2GB RAM
      tier = 'LOW';
      recommendedModelSize = 20; // 20MB quantized models only
    } else if (cpuCores <= 4 && memoryGB <= 4) {
      // Mid-range device: 2-4 cores, 2-4GB RAM
      tier = 'MID';
      recommendedModelSize = 50; // Up to 50MB models
    } else {
      // High-end device: 4+ cores, 4+ GB RAM
      tier = 'HIGH';
      recommendedModelSize = 200; // Can handle larger models
    }

    // Check if ONNX Runtime can run (WASM support)
    const canRunONNX = this.checkWASMSupport();

    this.profile = {
      tier,
      cpuCores,
      memoryGB,
      isLowEnd: tier === 'LOW',
      canRunONNX,
      recommendedModelSize
    };

    console.log('🔍 Device Assessment:', this.profile);
    return this.profile;
  }

  /**
   * Check if WebAssembly is supported
   * @returns boolean
   */
  private checkWASMSupport(): boolean {
    try {
      if (typeof WebAssembly === 'object' &&
          typeof WebAssembly.instantiate === 'function') {
        const module = new WebAssembly.Module(
          Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
        );
        if (module instanceof WebAssembly.Module) {
          return true;
        }
      }
    } catch (e) {
      console.warn('WebAssembly not supported:', e);
    }
    return false;
  }

  /**
   * Get current device profile
   * @returns HardwareProfile or null if not assessed
   */
  getProfile(): HardwareProfile | null {
    return this.profile;
  }

  /**
   * Check if device is low-end
   * @returns boolean
   */
  isLowEnd(): boolean {
    if (!this.profile) {
      this.assessHardware();
    }
    return this.profile?.isLowEnd || false;
  }

  /**
   * Get recommended batch size for inference
   * @returns number
   */
  getRecommendedBatchSize(): number {
    if (!this.profile) {
      this.assessHardware();
    }

    switch (this.profile?.tier) {
      case 'LOW':
        return 1; // Process one at a time
      case 'MID':
        return 4;
      case 'HIGH':
        return 8;
      default:
        return 1;
    }
  }

  /**
   * Get device tier emoji
   * @returns string
   */
  getTierEmoji(): string {
    if (!this.profile) {
      this.assessHardware();
    }

    switch (this.profile?.tier) {
      case 'LOW':
        return '🥔'; // Potato
      case 'MID':
        return '⚡';
      case 'HIGH':
        return '🚀';
      default:
        return '❓';
    }
  }

  /**
   * Get tier display name
   * @returns string
   */
  getTierName(): string {
    if (!this.profile) {
      this.assessHardware();
    }

    switch (this.profile?.tier) {
      case 'LOW':
        return 'Nano-Optimized';
      case 'MID':
        return 'Balanced';
      case 'HIGH':
        return 'Performance';
      default:
        return 'Unknown';
    }
  }
}

// Export singleton instance
export const deviceCapability = DeviceCapability.getInstance();

