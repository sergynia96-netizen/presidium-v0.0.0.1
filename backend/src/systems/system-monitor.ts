/**
 * System Monitor
 * 
 * Real-time мониторинг ресурсов, статистики и здоровья системы
 */

import * as os from 'os';
import { SystemMetrics, HealthStatus, Alert } from '../models/types';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

const monitorLogger = logger.createChild({ module: 'monitor' });

/**
 * System Monitor Class
 * 
 * Собирает метрики CPU, RAM, Disk, Network каждые 500ms
 */
export class SystemMonitor {
  private metricsHistory: SystemMetrics[] = [];
  private currentMetrics: SystemMetrics | null = null;
  private alerts: Alert[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private historyRetention: number;
  private alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
    networkLatency: number;
  };
  private lastCpuUsage: os.CpuInfo[] = [];
  private lastCpuTime: number = 0;
  private lastNetworkStats: { bytesIn: number; bytesOut: number } = { bytesIn: 0, bytesOut: 0 };

  constructor() {
    const config = getConfig('monitoring');
    this.historyRetention = config?.historyRetention || 3600000; // 1 hour
    this.alertThresholds = config?.alertThresholds || {
      cpu: 90,
      memory: 80,
      disk: 85,
      networkLatency: 500,
    };

    // Start monitoring
    this.start();
  }

  /**
   * Start monitoring loop
   */
  private start(): void {
    // Initial metrics
    this.collectMetrics();

    // Update every 500ms
    const interval = getConfig('monitoring.updateInterval') || 500;
    this.updateInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);
    // Allow process to exit even if timer is running
    if (this.updateInterval && typeof this.updateInterval.unref === 'function') {
      this.updateInterval.unref();
    }

    monitorLogger.info('System monitor started', { interval });
  }

  /**
   * Collect system metrics
   */
  private collectMetrics(): void {
    const timestamp = Date.now();

    // CPU metrics
    const cpus = os.cpus();
    const cpuUsage = this.calculateCpuUsage(cpus);
    const coreUsages = cpus.map((_, index) => this.calculateCoreUsage(cpus[index], index));

    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Disk metrics (simplified - в production используйте node-disk-info)
    const diskStats = this.getDiskStats();

    // Network metrics
    const networkStats = this.getNetworkStats();

    // Thread metrics (simplified - в production используйте worker_threads API)
    const threads = this.getThreadMetrics();

    const metrics: SystemMetrics = {
      timestamp,
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        coreUsages,
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        usage: (usedMemory / totalMemory) * 100,
        free: freeMemory,
      },
      disk: {
        used: diskStats.used,
        total: diskStats.total,
        usage: (diskStats.used / diskStats.total) * 100,
        ioRead: diskStats.ioRead,
        ioWrite: diskStats.ioWrite,
      },
      network: {
        bytesIn: networkStats.bytesIn,
        bytesOut: networkStats.bytesOut,
        packetsIn: 0, // TODO: Implement packet counting
        packetsOut: 0,
        latency: networkStats.latency,
      },
      threads: {
        active: threads.active,
        max: threads.max,
        utilization: (threads.active / threads.max) * 100,
      },
    };

    this.currentMetrics = metrics;
    this.metricsHistory.push(metrics);

    // Keep only last hour of history (1s resolution = 3600 entries)
    const maxHistorySize = 3600;
    if (this.metricsHistory.length > maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Check alerts
    this.checkAlerts(metrics);

    // Store last CPU info for next calculation
    this.lastCpuUsage = cpus;
    this.lastCpuTime = timestamp;
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(cpus: os.CpuInfo[]): number {
    if (this.lastCpuUsage.length === 0) {
      return 0;
    }

    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const lastCpu = this.lastCpuUsage[i];

      const idle = cpu.times.idle;
      const lastIdle = lastCpu.times.idle;

      const tick = (Object.values(cpu.times) as number[]).reduce((a: number, b: number) => a + b, 0);
      const lastTick = (Object.values(lastCpu.times) as number[]).reduce((a: number, b: number) => a + b, 0);

      totalIdle += idle - lastIdle;
      totalTick += tick - lastTick;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((idle / total) * 100);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Calculate single core usage
   */
  private calculateCoreUsage(cpu: os.CpuInfo, index: number): number {
    if (this.lastCpuUsage.length === 0 || !this.lastCpuUsage[index]) {
      return 0;
    }

    const lastCpu = this.lastCpuUsage[index];
    const idle = cpu.times.idle - lastCpu.times.idle;
    const total = (Object.values(cpu.times) as number[]).reduce((a: number, b: number) => a + b, 0) -
      (Object.values(lastCpu.times) as number[]).reduce((a: number, b: number) => a + b, 0);

    const usage = 100 - ~~((idle / total) * 100);
    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Get disk stats (simplified)
   */
  private getDiskStats(): { used: number; total: number; ioRead: number; ioWrite: number } {
    // NOTE: Упрощенная реализация
    // В production используйте node-disk-info или os.statfs (Linux)
    // Для Windows используйте wmic или powershell

    // Get disk space (simplified - использует totalmem как placeholder)
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Scale to simulate disk (64GB)
    const diskTotal = 64 * 1024 * 1024 * 1024; // 64 GB
    const diskUsed = (usedMemory / totalMemory) * diskTotal * 0.1; // ~10% of RAM as disk

    // I/O stats (simplified - в production используйте iostat или node-disk-info)
    const ioRead = Math.random() * 1024 * 1024; // Random 0-1 MB/s
    const ioWrite = Math.random() * 512 * 1024; // Random 0-512 KB/s

    return {
      used: diskUsed,
      total: diskTotal,
      ioRead,
      ioWrite,
    };
  }

  /**
   * Get network stats
   */
  private getNetworkStats(): { bytesIn: number; bytesOut: number; latency?: number } {
    // NOTE: Упрощенная реализация
    // В production используйте os.networkInterfaces() и пакеты сети

    const interfaces = os.networkInterfaces();
    let bytesIn = 0;
    let bytesOut = 0;

    // Calculate network stats (simplified)
    // В реальной реализации нужно отслеживать сетевой трафик
    bytesIn = this.lastNetworkStats.bytesIn + Math.random() * 1000;
    bytesOut = this.lastNetworkStats.bytesOut + Math.random() * 500;

    this.lastNetworkStats = { bytesIn, bytesOut };

    // Latency (simplified - в production измеряйте RTT)
    const latency = Math.random() * 100; // 0-100ms

    return { bytesIn, bytesOut, latency };
  }

  /**
   * Get thread metrics
   */
  private getThreadMetrics(): { active: number; max: number } {
    // NOTE: Упрощенная реализация
    // В production используйте worker_threads API

    // Simulate threads
    const active = Math.max(1, Math.floor(Math.random() * 10) + 1);
    const max = 10;

    return { active, max };
  }

  /**
   * Check alerts based on thresholds
   */
  private checkAlerts(metrics: SystemMetrics): void {
    const alerts: Alert[] = [];

    // CPU alert
    if (metrics.cpu.usage > this.alertThresholds.cpu) {
      alerts.push({
        type: 'cpu',
        message: `CPU usage is ${metrics.cpu.usage.toFixed(1)}% (threshold: ${this.alertThresholds.cpu}%)`,
        severity: metrics.cpu.usage > 95 ? 'error' : 'warn',
        timestamp: metrics.timestamp,
      });
    }

    // Memory alert
    if (metrics.memory.usage > this.alertThresholds.memory) {
      alerts.push({
        type: 'memory',
        message: `Memory usage is ${metrics.memory.usage.toFixed(1)}% (threshold: ${this.alertThresholds.memory}%)`,
        severity: metrics.memory.usage > 90 ? 'error' : 'warn',
        timestamp: metrics.timestamp,
      });
    }

    // Disk alert
    if (metrics.disk.usage > this.alertThresholds.disk) {
      alerts.push({
        type: 'disk',
        message: `Disk usage is ${metrics.disk.usage.toFixed(1)}% (threshold: ${this.alertThresholds.disk}%)`,
        severity: metrics.disk.usage > 90 ? 'error' : 'warn',
        timestamp: metrics.timestamp,
      });
    }

    // Network latency alert
    if (metrics.network.latency && metrics.network.latency > this.alertThresholds.networkLatency) {
      alerts.push({
        type: 'network',
        message: `Network latency is ${metrics.network.latency.toFixed(1)}ms (threshold: ${this.alertThresholds.networkLatency}ms)`,
        severity: 'warn',
        timestamp: metrics.timestamp,
      });
    }

    // Store alerts
    if (alerts.length > 0) {
      this.alerts.push(...alerts);
      alerts.forEach(alert => {
        monitorLogger.warn(`Alert: ${alert.message}`, { severity: alert.severity });
      });
    }

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): SystemMetrics {
    if (!this.currentMetrics) {
      this.collectMetrics();
    }
    return this.currentMetrics!;
  }

  /**
   * Get metrics history
   */
  getHistory(from?: number, to?: number): SystemMetrics[] {
    if (!from && !to) {
      return [...this.metricsHistory];
    }

    return this.metricsHistory.filter(metric => {
      if (from && metric.timestamp < from) return false;
      if (to && metric.timestamp > to) return false;
      return true;
    });
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    const metrics = this.getMetrics();
    const recentAlerts = this.alerts.filter(a => a.timestamp > Date.now() - 60000); // Last minute

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Determine status based on alerts
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'error');
    const warningAlerts = recentAlerts.filter(a => a.severity === 'warn');

    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    return {
      status,
      timestamp: metrics.timestamp,
      alerts: recentAlerts,
      metrics,
    };
  }

  /**
   * Get alerts
   */
  getAlerts(severity?: 'info' | 'warn' | 'error'): Alert[] {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    monitorLogger.info('System monitor shutdown');
  }
}

