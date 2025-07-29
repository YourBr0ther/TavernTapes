/**
 * Centralized logging utility for TavernTapes
 * Provides consistent error logging, debugging, and performance tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  component?: string;
  service?: string;
  method?: string;
  sessionId?: string;
  userId?: string;
  timestamp?: string;
  [key: string]: any;
}

export class Logger {
  private static isDevelopment = process.env.NODE_ENV === 'development';
  private static isTest = process.env.NODE_ENV === 'test';

  /**
   * Log an error with structured context
   */
  static error(message: string, error?: Error | unknown, context: LogContext = {}): void {
    const logData = this.formatLog('error', message, context, error);
    console.error(logData.formatted, logData.data);
    
    // In production, you might want to send errors to a logging service
    if (!this.isDevelopment && !this.isTest) {
      // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    }
  }

  /**
   * Log a warning with context
   */
  static warn(message: string, context: LogContext = {}): void {
    const logData = this.formatLog('warn', message, context);
    console.warn(logData.formatted, logData.data);
  }

  /**
   * Log informational messages (only in development)
   */
  static info(message: string, context: LogContext = {}): void {
    if (this.isDevelopment) {
      const logData = this.formatLog('info', message, context);
      console.info(logData.formatted, logData.data);
    }
  }

  /**
   * Log debug messages (only in development)
   */
  static debug(message: string, context: LogContext = {}): void {
    if (this.isDevelopment) {
      const logData = this.formatLog('debug', message, context);
      console.debug(logData.formatted, logData.data);
    }
  }

  /**
   * Log performance metrics
   */
  static performance(operation: string, duration: number, context: LogContext = {}): void {
    if (this.isDevelopment) {
      const performanceContext = { ...context, duration: `${duration}ms`, operation };
      this.info(`Performance: ${operation} completed`, performanceContext);
    }
  }

  /**
   * Log state changes for debugging
   */
  static stateChange(component: string, from: any, to: any, context: LogContext = {}): void {
    if (this.isDevelopment) {
      const stateContext = { 
        ...context, 
        component, 
        previousState: from, 
        newState: to 
      };
      this.debug(`State change in ${component}`, stateContext);
    }
  }

  /**
   * Format log message with consistent structure
   */
  private static formatLog(
    level: LogLevel, 
    message: string, 
    context: LogContext, 
    error?: Error | unknown
  ) {
    const timestamp = new Date().toISOString();
    const contextStr = this.buildContextString(context);
    
    const formatted = `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}`;
    
    const data: any = { timestamp, level, message, ...context };
    
    if (error) {
      if (error instanceof Error) {
        data.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else {
        data.error = error;
      }
    }

    return { formatted, data };
  }

  /**
   * Build context string for log formatting
   */
  private static buildContextString(context: LogContext): string {
    const parts: string[] = [];
    
    if (context.service) parts.push(`[${context.service}]`);
    if (context.component) parts.push(`[${context.component}]`);
    if (context.method) parts.push(`[${context.method}]`);
    if (context.sessionId) parts.push(`[Session:${context.sessionId}]`);
    
    return parts.length > 0 ? ` ${parts.join('')}` : '';
  }
}

// Convenience methods for common use cases
export const logError = (message: string, error?: Error | unknown, context?: LogContext) => 
  Logger.error(message, error, context);

export const logWarn = (message: string, context?: LogContext) => 
  Logger.warn(message, context);

export const logInfo = (message: string, context?: LogContext) => 
  Logger.info(message, context);

export const logDebug = (message: string, context?: LogContext) => 
  Logger.debug(message, context);

export const logPerformance = (operation: string, duration: number, context?: LogContext) => 
  Logger.performance(operation, duration, context);

export const logStateChange = (component: string, from: any, to: any, context?: LogContext) => 
  Logger.stateChange(component, from, to, context);

// Service-specific loggers
export const createServiceLogger = (serviceName: string) => ({
  error: (message: string, error?: Error | unknown, context: LogContext = {}) => 
    Logger.error(message, error, { ...context, service: serviceName }),
  warn: (message: string, context: LogContext = {}) => 
    Logger.warn(message, { ...context, service: serviceName }),
  info: (message: string, context: LogContext = {}) => 
    Logger.info(message, { ...context, service: serviceName }),
  debug: (message: string, context: LogContext = {}) => 
    Logger.debug(message, { ...context, service: serviceName }),
});

// Component-specific loggers
export const createComponentLogger = (componentName: string) => ({
  error: (message: string, error?: Error | unknown, context: LogContext = {}) => 
    Logger.error(message, error, { ...context, component: componentName }),
  warn: (message: string, context: LogContext = {}) => 
    Logger.warn(message, { ...context, component: componentName }),
  info: (message: string, context: LogContext = {}) => 
    Logger.info(message, { ...context, component: componentName }),
  debug: (message: string, context: LogContext = {}) => 
    Logger.debug(message, { ...context, component: componentName }),
  stateChange: (from: any, to: any, context: LogContext = {}) => 
    Logger.stateChange(componentName, from, to, context),
});

export default Logger;