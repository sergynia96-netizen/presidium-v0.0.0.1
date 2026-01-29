/**
 * Metrics Service - System metrics and monitoring
 * Now with REAL system metrics from Node.js process
 */

import * as os from 'os';
import { SystemMetrics, DashboardStats } from '../types/system.types';
import { P2PService } from './p2p.service';
import { CRDTService } from './crdt.service';
import { ReputationService } from './reputation.service';

export class MetricsService {
  private static startTime = Date.now();
  private static requestCount = 0;
  private static lastCpuUsage = process.cpuUsage();
  private static lastCpuTime = Date.now();

  /**
   * Get REAL system metrics from Node.js process
   */
  static getMetrics(): SystemMetrics {
    this.requestCount++;
    
    // Real memory usage
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;
    
    // Real CPU usage (average over interval)
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTime = Date.now();
    const timeDiff = (currentTime - this.lastCpuTime) * 1000; // microseconds
    const cpuPercent = timeDiff > 0 
      ? Math.min(100, ((currentCpuUsage.user + currentCpuUsage.system) / timeDiff) * 100)
      : 0;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = currentTime;
    
    // P2P sessions
    const p2p = P2PService.getNetworkStatus();
    
    // System uptime
    const uptime = process.uptime();

    return {
      // Real memory from process
      aiMemory: {
        used: memUsage.heapUsed / (1024 * 1024 * 1024), // GB
        total: memUsage.heapTotal / (1024 * 1024 * 1024), // GB
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      // System memory
      memory: {
        used: usedMem,
        total: totalMem,
        usage: memPercentage
      },
      // Storage (placeholder - would need disk API)
      storage: {
        used: memUsage.heapUsed / (1024 * 1024 * 1024),
        total: 64.0,
        percentage: (memUsage.heapUsed / (1024 * 1024 * 1024)) / 64 * 100
      },
      // Real process threads/sessions
      activeThreads: p2p.activeSessions || 1,
      activeSessions: p2p.activeSessions || 0,
      maxSessions: 100,
      // CPU usage
      cpuUsage: Math.round(cpuPercent),
      cpu: {
        usage: Math.round(cpuPercent),
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown'
      },
      // System info
      threads: {
        active: p2p.activeSessions || 1,
        max: 100
      },
      // Network (from P2P)
      networkUsage: {
        upload: p2p.activeSessions * 1024 * 10, // Estimate
        download: p2p.activeSessions * 1024 * 20
      },
      // Additional real stats
      uptime: Math.floor(uptime),
      requestCount: this.requestCount,
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  /**
   * Get complete dashboard stats
   */
  static getDashboardStats(): DashboardStats {
    return {
      crdt: CRDTService.getState(),
      p2p: P2PService.getNetworkStatus(),
      metrics: this.getMetrics(),
      reputation: ReputationService.getReputation(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update metrics manually
   */
  static updateMetrics(updates: Partial<SystemMetrics>): void {
    this.metrics = { ...this.metrics, ...updates };
    
    // Recalculate percentages
    if (updates.aiMemory?.used !== undefined || updates.aiMemory?.total !== undefined) {
      this.metrics.aiMemory.percentage = 
        (this.metrics.aiMemory.used / this.metrics.aiMemory.total) * 100;
    }
    
    if (updates.storage?.used !== undefined || updates.storage?.total !== undefined) {
      this.metrics.storage.percentage = 
        (this.metrics.storage.used / this.metrics.storage.total) * 100;
    }
  }
}

