/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the application.
 * In production, logs are JSON-formatted for easy parsing by log aggregators.
 * In development, logs are human-readable.
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Structured metadata
 * - Request ID tracking
 * - Automatic timestamp
 * - Production-safe (no PII logging)
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("User action", { userId: "xxx", action: "pulse_created" });
 *   logger.error("API failed", { service: "openai", error: err.message });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  requestId?: string;
  userId?: string;
  service?: string;
  action?: string;
  duration_ms?: number;
  [key: string]: unknown;
};

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level based on environment
const MIN_LOG_LEVEL: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

/**
 * Format log entry for output
 */
function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    // JSON format for production (log aggregators)
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const contextStr = entry.context
    ? ` ${JSON.stringify(entry.context)}`
    : "";
  return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`;
}

/**
 * Create a log entry and output it
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 && { context }),
  };

  const formatted = formatLog(entry);

  switch (level) {
    case "debug":
    case "info":
      console.log(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

/**
 * Logger instance with convenience methods
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),

  /**
   * Create a child logger with preset context
   */
  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      log("debug", message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log("info", message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log("warn", message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) =>
      log("error", message, { ...baseContext, ...context }),
  }),

  /**
   * Log API request timing
   */
  apiRequest: (
    method: string,
    path: string,
    statusCode: number,
    duration_ms: number,
    context?: LogContext
  ) => {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    log(level, `${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      duration_ms,
      ...context,
    });
  },

  /**
   * Log external service call
   */
  serviceCall: (
    service: string,
    operation: string,
    success: boolean,
    duration_ms: number,
    context?: LogContext
  ) => {
    const level: LogLevel = success ? "info" : "error";
    log(level, `${service}.${operation} ${success ? "succeeded" : "failed"}`, {
      service,
      operation,
      success,
      duration_ms,
      ...context,
    });
  },
};

/**
 * Monitoring utilities for critical services
 */
export const monitor = {
  /**
   * Check if Anthropic API key is configured
   */
  isAnthropicConfigured: (): boolean => {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  /**
   * Check if OpenAI API key is configured
   */
  isOpenAIConfigured: (): boolean => {
    return !!process.env.OPENAI_API_KEY;
  },

  /**
   * Check if Supabase is configured
   */
  isSupabaseConfigured: (): boolean => {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  },

  /**
   * Get configuration status summary
   */
  getConfigStatus: () => ({
    supabase: monitor.isSupabaseConfigured(),
    anthropic: monitor.isAnthropicConfigured(),
    openai: monitor.isOpenAIConfigured(),
    vapid: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    cronSecret: !!process.env.CRON_SECRET,
    adminSecret: !!process.env.ADMIN_SECRET,
  }),

  /**
   * Log startup configuration status
   */
  logStartupStatus: () => {
    const config = monitor.getConfigStatus();
    const missing = Object.entries(config)
      .filter(([, configured]) => !configured)
      .map(([name]) => name);

    if (missing.length > 0) {
      logger.warn("Missing configuration", { missing });
    } else {
      logger.info("All services configured");
    }

    return config;
  },
};

export default logger;
