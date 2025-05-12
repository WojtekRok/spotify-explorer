// Consistent logging service with environment-aware behavior

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Centralized logging service
 * - Prefixes all logs with source information
 * - Can be disabled in production
 * - Supports different log levels
 */
@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private readonly APP_NAME = 'Spotify-Explorer';
  private readonly isProduction = environment.production;
  
  /**
   * Standard log message
   */
  log(message: string, ...optionalParams: any[]): void {
    if (this.isProduction) return;
    console.log(`[${this.APP_NAME}] ${message}`, ...optionalParams);
  }
  
  /**
   * Warning log message - always shown, even in production
   */
  warn(message: string, ...optionalParams: any[]): void {
    console.warn(`[${this.APP_NAME}] WARNING: ${message}`, ...optionalParams);
  }
  
  /**
   * Error log message - always shown, even in production
   */
  error(message: string, ...optionalParams: any[]): void {
    console.error(`[${this.APP_NAME}] ERROR: ${message}`, ...optionalParams);
  }
  
  /**
   * Debug log message - only in development
   */
  debug(message: string, ...optionalParams: any[]): void {
    if (this.isProduction) return;
    console.debug(`[${this.APP_NAME}] DEBUG: ${message}`, ...optionalParams);
  }
  
  /**
   * Group logs for better organization
   */
  group(label: string): void {
    if (this.isProduction) return;
    console.group(`[${this.APP_NAME}] ${label}`);
  }
  
  /**
   * End a log group
   */
  groupEnd(): void {
    if (this.isProduction) return;
    console.groupEnd();
  }
}