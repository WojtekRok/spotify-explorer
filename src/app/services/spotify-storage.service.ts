// spotify-storage.service.ts
// Handles storage of authentication tokens and related data

import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class SpotifyStorageService {
  // Storage keys
  private readonly TOKEN_KEY = 'spotify_access_token';
  private readonly REFRESH_TOKEN_KEY = 'spotify_refresh_token';
  private readonly TOKEN_EXPIRY_KEY = 'spotify_token_expiry';
  private readonly CODE_VERIFIER_KEY = 'spotify_code_verifier';
  
  // Browser detection
  public readonly isBrowser: boolean;
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
  
  /**
   * Set the access token in storage
   */
  public setToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  
  /**
   * Get the access token from storage
   */
  public getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  /**
   * Set the refresh token in storage
   */
  public setRefreshToken(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }
  
  /**
   * Get the refresh token from storage
   */
  public getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }
  
  /**
   * Set token expiration time
   * @param expiresIn Seconds until token expires
   */
  public setTokenExpiration(expiresIn: number): void {
    if (!this.isBrowser) return;
    // Calculate absolute expiry time (current time + expiration seconds)
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
  }
  
  /**
   * Check if the current token is expired
   * @returns boolean True if token is expired or expiry time not found
   */
  public isTokenExpired(): boolean {
    if (!this.isBrowser) return true;
    
    const expiryTimeStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryTimeStr) return true;
    
    const expiryTime = parseInt(expiryTimeStr, 10);
    // Consider expired if within 60 seconds of expiry to be safe
    return Date.now() > (expiryTime - 60000);
  }
  
  /**
   * Set the PKCE code verifier in storage
   */
  public setCodeVerifier(verifier: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.CODE_VERIFIER_KEY, verifier);
  }
  
  /**
   * Get the PKCE code verifier from storage
   */
  public getCodeVerifier(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(this.CODE_VERIFIER_KEY);
  }
  
  /**
   * Clear the PKCE code verifier from storage
   */
  public clearCodeVerifier(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.CODE_VERIFIER_KEY);
  }
  
  /**
   * Clear all authentication-related storage
   */
  public clearAuthStorage(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    this.clearCodeVerifier();
  }
  
  /**
   * Clear all Spotify-related storage
   */
  public clearAllStorage(): void {
    if (!this.isBrowser) return;
    this.clearAuthStorage();
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    // Clear any other Spotify-related storage items
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_auth_return_path');
  }
}