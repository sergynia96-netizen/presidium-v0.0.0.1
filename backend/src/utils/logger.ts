/**
 * Structured Logging
 */

import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
  [key: string]: any;
}

interface Timer {
  start: number;
  label: string;
}

export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;
  private timers: Map<string, Timer>;

  constructor(context: LogContext = {}, minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
    this.timers = new Map();
  }

  /**
   * Create a child logger with additional context
   */
  createChild(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext }, this.minLevel);
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
    };

    if (data) {
      if (data instanceof Error) {
        entry.error = {
          name: data.name,
          message: data.message,
          stack: data.stack,
        };
      } else if (typeof data === 'object') {
        Object.assign(entry, data);
      } else {
        entry.data = data;
      }
    }

    this.write(entry);
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    // Structured JSON logging
    const json = JSON.stringify(entry);
    const level = entry.level.toUpperCase().padEnd(5);

    // Color codes for console
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';

    // Console output
    if (entry.level === 'error' || entry.level === 'fatal') {
      console.error(`${color}${level}${reset} ${entry.timestamp} ${entry.message}`, entry);
    } else {
      console.log(`${color}${level}${reset} ${entry.timestamp} ${entry.message}`, entry);
    }

    // TODO: File output with rotation
    // TODO: Prometheus metrics export
  }

  /**
   * Debug level log
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Info level log
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Warn level log
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error | any): void {
    this.log('error', error?.message || String(error), error);
  }

  /**
   * Fatal level log
   */
  fatal(message: string, error?: Error | any): void {
    this.log('fatal', message, error);
  }

  /**
   * Start a performance timer
   */
  time(label: string): void {
    const timerId = randomUUID();
    this.timers.set(label, {
      start: Date.now(),
      label,
    });
  }

  /**
   * End a performance timer and log duration
   */
  timeEnd(label: string): number {
    const timer = this.timers.get(label);
    if (!timer) {
      this.warn(`Timer '${label}' not found`);
      return 0;
    }

    const duration = Date.now() - timer.start;
    this.info(`⏱️  ${label}`, { duration: `${duration}ms` });
    this.timers.delete(label);

    return duration;
  }
}

// Default logger instance
export const logger = new Logger({ module: 'presidium' });

