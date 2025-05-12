// Core API interaction service for Spotify
import { Injectable } from '@angular/core';
import { SpotifyAuthService } from './spotify-auth.service';
import { LoggerService } from './logger.service';
import { firstValueFrom, from, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Utility function to introduce delay (for rate limiting)
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

@Injectable({
  providedIn: 'root'
})
export class SpotifyApiService {
  private readonly apiUrl = 'https://api.spotify.com/v1';
  private readonly MAX_RETRIES = 3;
  
  constructor(
    private authService: SpotifyAuthService,
    private logger: LoggerService
  ) {}
  
  /**
   * Core method to interact with Spotify Web API
   * - Handles authentication
   * - Manages retries and rate limiting
   * - Processes common errors
   * 
   * @param endpoint API endpoint (with or without base URL)
   * @param method HTTP method
   * @param body Optional request body
   * @param retries Number of retries allowed
   * @returns Promise with typed response
   */
  public async fetchWebApi<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    // Ensure valid token before making request
    const token = await this.authService.ensureValidToken();
    
    if (!token) {
      throw new Error('Cannot make API request: User not authenticated');
    }
    
    // Construct full URL if needed
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;
    
    try {
      this.logger.debug(`API Request: ${method} ${endpoint}`);
      
      // Prepare headers based on method and body
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`
      };
      
      // Add content-type for requests with body
      if (method !== 'GET' && body) {
        headers['Content-Type'] = 'application/json';
      }
      
      // Make the request
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      
      // Handle rate limiting (429)
      if (response.status === 429 && retries > 0) {
        const retryAfterSec = parseInt(response.headers.get('Retry-After') || '2', 10);
        this.logger.warn(`Rate limited (429). Retrying after ${retryAfterSec}s...`);
        await delay(retryAfterSec * 1000);
        return this.fetchWebApi<T>(endpoint, method, body, retries - 1);
      }
      
      // Handle authentication errors (401)
      if (response.status === 401 && !url.includes('accounts.spotify.com')) {
        this.logger.error('Authentication failed (401)');
        this.authService.logout();
        throw new Error('Authorization invalid (401)');
      }
      
      // Handle permission errors (403)
      if (response.status === 403) {
        this.logger.error('Permission denied (403)');
        throw new Error('Permission denied (403)');
      }
      
      // Handle other error responses
      if (!response.ok) {
        let errorMsg = `API request failed: ${response.status}`;
        
        try {
          // Try to parse error response for more details
          const errorBody = await response.json();
          errorMsg += ` - ${errorBody?.error?.message || 'Unknown error'}`;
        } catch (e) {
          // Unable to parse error body, continue with basic error
        }
        
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Handle empty responses
      const contentLength = response.headers.get('content-length');
      if (response.status === 204 || (contentLength !== null && parseInt(contentLength, 10) === 0)) {
        return null as T;
      }
      
      // Parse JSON response
      try {
        return await response.json() as T;
      } catch (e) {
        this.logger.error('Failed to parse API response as JSON');
        throw new Error('Failed to parse API response as JSON');
      }
    } catch (error) {
      this.logger.error(`Error during API call to ${endpoint}:`, error);
      throw error;
    }
  }
  
  /**
   * Wrapper for fetchWebApi as an Observable
   * For components that prefer the reactive approach
   */
  public getWebApi<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Observable<T> {
    return from(this.fetchWebApi<T>(endpoint, method, body)).pipe(
      catchError(error => {
        this.logger.error('Error in getWebApi:', error);
        throw error;
      })
    );
  }
  
  /**
   * Helper to build URL with query parameters
   */
  public buildUrl(endpoint: string, params: Record<string, string | number | boolean>): string {
    const urlParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        urlParams.append(key, value.toString());
      }
    }
    
    const queryString = urlParams.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }
  
  /**
   * Generic paginated fetch - gets all items from a paged endpoint
   */
  public async fetchAllPages<T, R>(
    initialUrl: string,
    itemsExtractor: (response: R) => T[],
    nextUrlExtractor: (response: R) => string | null
  ): Promise<T[]> {
    let allItems: T[] = [];
    let nextUrl: string | null = initialUrl;
    
    while (nextUrl) {
      try {
        this.logger.debug(`Fetching page: ${nextUrl}`);
        
        // Get the next page of results
        const response = await this.fetchWebApi<R>(nextUrl);
        
        // Extract and accumulate items
        const items = itemsExtractor(response);
        allItems = allItems.concat(items);
        
        // Get the next URL if available
        nextUrl = nextUrlExtractor(response);
        
        // Add small delay between requests
        if (nextUrl) await delay(100);
      } catch (error) {
        this.logger.error('Error during paginated fetch:', error);
        throw error;
      }
    }    
    return allItems;
  }
}