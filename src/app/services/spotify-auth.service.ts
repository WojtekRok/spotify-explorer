// spotify-auth.service.ts
// Handles authentication with Spotify API

import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { SpotifyStorageService } from './spotify-storage.service';
import { BehaviorSubject } from 'rxjs';
import { SpotifyTokenResponse } from '../models/spotify.models'; 
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class SpotifyAuthService {
  // Authentication URLs
  private readonly authorizationUrl = 'https://accounts.spotify.com/authorize';
  private readonly tokenUrl = 'https://accounts.spotify.com/api/token';
  
  // Environment variables
  private readonly clientId = environment.spotify.clientId;
  private readonly redirectUri = environment.spotify.redirectUri;
  
  // Token state
  private _token$ = new BehaviorSubject<string | null>(null);
  public token$ = this._token$.asObservable();
  
  // Auth state
  private _isLoggedIn$ = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._isLoggedIn$.asObservable();
  
  // Scopes required by the app
  private readonly scopes = [
    'user-read-private', 'user-read-email', 'user-top-read',
    'user-read-recently-played', 'playlist-read-private',
    'playlist-read-collaborative', 'playlist-modify-public',
    'playlist-modify-private', 'user-follow-read', 
    'user-library-read', 'user-library-modify', 'user-follow-modify'
  ];
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private storageService: SpotifyStorageService,
    private logger: LoggerService
  ) {
    // Initialize the token state from storage on service creation
    if (this.storageService.isBrowser) {
      this.refreshFromStorage();
    }
  }

  // Refresh token state from storage
  private refreshFromStorage(): void {
    const token = this.storageService.getToken();
    if (token && !this.storageService.isTokenExpired()) {
      this._token$.next(token);
      this._isLoggedIn$.next(true);
      this.logger.log('Token loaded from storage');
    } else if (this.storageService.getRefreshToken()) {
      // If we have a refresh token but no valid access token, try to refresh
      this.logger.log('Token expired but refresh token available, will refresh on next request');
    } else {
      this.logger.log('No valid authentication found in storage');
      this._token$.next(null);
      this._isLoggedIn$.next(false);
    }
  }

  // PKCE flow methods
  private generateRandomString(length: number): string {
    if (!this.storageService.isBrowser) return '';    
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
      .map(x => possible[x % possible.length])
      .join('');
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    if (!this.storageService.isBrowser) return '';
    
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Start the authorization flow with PKCE
   * @param returnPath Optional path to return to after auth
   */
  public authorize(returnPath: string = '/'): void {
    if (!this.storageService.isBrowser) return;
    
    try {
      // Store the return path
      localStorage.setItem('spotify_auth_return_path', returnPath);
      
      // Generate a random state value for CSRF protection
      const state = this.generateRandomString(16);
      localStorage.setItem('spotify_auth_state', state);
      
      // Generate code verifier (random string between 43-128 chars)
      const codeVerifier = this.generateRandomString(64);
      this.storageService.setCodeVerifier(codeVerifier);
      
      // Create code challenge from verifier
      this.generateCodeChallenge(codeVerifier).then(codeChallenge => {
        // Define the scopes needed
        const scope = this.scopes.join(' ');
        
        // Construct the authorization URL with PKCE parameters
        const authUrl = new URL(this.authorizationUrl);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('client_id', this.clientId);
        authUrl.searchParams.append('scope', scope);
        authUrl.searchParams.append('redirect_uri', this.redirectUri);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('code_challenge', codeChallenge);
        
        this.logger.log('Starting Spotify authorization with PKCE redirect to', authUrl.toString());
        
        // Redirect to the Spotify authorization page
        window.location.href = authUrl.toString();
      });
    } catch (error) {
      this.logger.error('Error starting authorization process:', error);
      throw error;
    }
  }

  /**
 * Handle the callback from Spotify auth
 * @returns Promise<boolean> Success of the token exchange
 */
  async handleCallback(): Promise<boolean> {
    this.logger.log("HandleCallback: Entered handleCallback method.");
    
    if (!this.storageService.isBrowser) {
      this.logger.warn('HandleCallback: Skipping: Not in browser environment.');
      return false;
    }
    
    // 1. Get params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    // 2. Check for errors from Spotify
    if (error) {
      this.logger.error(`HandleCallback: Error returned from Spotify: ${error}`);
      return false;
    }
    
    // 3. Retrieve stored state and verifier
    const storedState = localStorage.getItem('spotify_auth_state');
    const codeVerifier = this.storageService.getCodeVerifier();
    
    // 4. Validate state and presence of code/verifier
    if (!code || !state || !storedState) {
      this.logger.error('HandleCallback: Missing required parameters');
      return false;
    }
    
    if (state !== storedState) {
      this.logger.error('HandleCallback: State mismatch. Possible CSRF attack.');
      return false;
    }
    
    if (!codeVerifier) {
      this.logger.error('HandleCallback: Missing code verifier');
      return false;
    }
    
    // 5. Exchange authorization code for tokens using PKCE
    try {
      this.logger.log('HandleCallback: Exchanging code for tokens with PKCE');
      
      const tokenResponse = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier
        }).toString()
      });
      
      // 6. Check response status
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        this.logger.error(`HandleCallback: Token exchange failed: ${tokenResponse.status}`, errorText);
        return false;
      }
      
      // 7. Parse response and store tokens
      const tokenData: SpotifyTokenResponse = await tokenResponse.json();
      
      if (tokenData && tokenData.access_token) {
        // Clear any old tokens first
        this.storageService.clearAuthStorage();
        
        // Store new tokens
        this.storageService.setToken(tokenData.access_token);
        this.storageService.setTokenExpiration(tokenData.expires_in);
        
        if (tokenData.refresh_token) {
          this.storageService.setRefreshToken(tokenData.refresh_token);
          this.logger.log("HandleCallback: Refresh token stored.");
        }
        
        // Set token in service state
        this._token$.next(tokenData.access_token);
        this._isLoggedIn$.next(true);
        
        // 8. Clean up temporary localStorage items
        localStorage.removeItem('spotify_auth_state');
        this.storageService.clearCodeVerifier();
        
        this.logger.log("HandleCallback: Token stored, callback successful.");
        return true;
      } else {
        this.logger.error('HandleCallback: Token data missing or invalid in response.');
        return false;
      }
    } catch (error) {
      this.logger.error('HandleCallback: Error during token exchange:', error);
      return false;
    }
  }

 /**
 * Refresh the access token using refresh token
 */
public async refreshAccessToken(): Promise<boolean> {
  if (!this.storageService.isBrowser) return false;
  
  const refreshToken = this.storageService.getRefreshToken();
  if (!refreshToken) {
    this.logger.warn("RefreshToken: No refresh token available.");
    return false;
  }
  
  try {
    this.logger.log("RefreshToken: Attempting to refresh access token...");
    
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`RefreshToken: Refresh token request failed: ${response.status}`, errorText);
      
      // Only clear refresh token if it's a 400 error (invalid token)
      if (response.status === 400) {
        this.logger.warn("RefreshToken: Invalid refresh token, clearing auth data.");
        this.storageService.clearAuthStorage();
        this._token$.next(null);
        this._isLoggedIn$.next(false);
      }
      
      return false;
    }
    
    const json: SpotifyTokenResponse = await response.json();
    
    if (json.access_token) {
      // Update token in storage
      this.storageService.setToken(json.access_token);
      this.storageService.setTokenExpiration(json.expires_in);
      
      // Update token in service state
      this._token$.next(json.access_token);
      this._isLoggedIn$.next(true);
      
      // Store new refresh token if provided
      if (json.refresh_token) {
        this.storageService.setRefreshToken(json.refresh_token);
        this.logger.log("RefreshToken: New refresh token stored.");
      }
      
      this.logger.log("RefreshToken: Access token refreshed successfully.");
      return true;
    } else {
      this.logger.error("RefreshToken: Response missing access_token.");
      return false;
    }
  } catch (error) {
    this.logger.error("RefreshToken: Error during token refresh:", error);
    return false;
  }
}

  /**
 * Ensure the token is valid, refreshing if needed
 * @returns Promise<string | null> Valid token or null if unavailable
 */
public async ensureValidToken(): Promise<string | null> {
  if (!this.storageService.isBrowser) return null;
  
  // Check if we have a token in memory first
  let currentToken = this._token$.value;
  
  // If not in memory, try to get from storage
  if (!currentToken) {
    currentToken = this.storageService.getToken();
    
    // If found in storage and valid, update memory state
    if (currentToken && !this.storageService.isTokenExpired()) {
      this._token$.next(currentToken);
      this._isLoggedIn$.next(true);
    }
  }
  
  // If token exists but is expired, try to refresh
  if ((currentToken && this.storageService.isTokenExpired()) || !currentToken) {
    this.logger.log("Token missing or expired, attempting refresh...");
    const refreshSuccess = await this.refreshAccessToken();
    
    if (!refreshSuccess) {
      this.logger.warn("No valid token after refresh attempt.");
      this._token$.next(null);
      this._isLoggedIn$.next(false);
      return null;
    }
    
    // Get the new token after refresh
    return this._token$.value;
  }
  
  return currentToken;
}

  /**
   * Check if user is currently logged in
   */
  public isLoggedIn(): boolean {
    if (!this.storageService.isBrowser) return false;
    
    // First check if we have an active token in memory
    if (this._token$.value) {
      return true;
    }
    
    // Then check storage
    const hasToken = !!this.storageService.getToken();
    const isNotExpired = !this.storageService.isTokenExpired();
    const hasRefreshToken = !!this.storageService.getRefreshToken();
    
    // Consider logged in if we have a valid token OR a refresh token
    return (hasToken && isNotExpired) || hasRefreshToken;
  }

  /**
   * Log out user by clearing tokens
   */
  public logout(): void {
    if (!this.storageService.isBrowser) return;
    
    // Update service state
    this._token$.next(null);
    this._isLoggedIn$.next(false);
    
    // Clear storage
    this.storageService.clearAllStorage();
    
    this.logger.log("User logged out.");
    
    // Redirect if not on home page
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  }
}