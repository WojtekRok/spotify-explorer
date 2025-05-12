// spotify-storage.service.ts
// Handles storage of authentication tokens and related data

import { Injectable, Inject } from '@angular/core';
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
  
  
  constructor() {}
  
  /**
   * Set the access token in storage
   */
  public setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  
  /**
   * Get the access token from storage
   */
  public getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  /**
   * Set the refresh token in storage
   */
  public setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }
  
  /**
   * Get the refresh token from storage
   */
  public getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }
  
  /**
   * Set token expiration time
   * @param expiresIn Seconds until token expires
   */
  public setTokenExpiration(expiresIn: number): void {
    // Calculate absolute expiry time (current time + expiration seconds)
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
  }
  
  /**
   * Check if the current token is expired
   * @returns boolean True if token is expired or expiry time not found
   */
  public isTokenExpired(): boolean {
    
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
    localStorage.setItem(this.CODE_VERIFIER_KEY, verifier);
  }
  
  /**
   * Get the PKCE code verifier from storage
   */
  public getCodeVerifier(): string | null {
    return localStorage.getItem(this.CODE_VERIFIER_KEY);
  }
  
  /**
   * Clear the PKCE code verifier from storage
   */
  public clearCodeVerifier(): void {
    localStorage.removeItem(this.CODE_VERIFIER_KEY);
  }
  
  /**
   * Clear all authentication-related storage
   */
  public clearAuthStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    this.clearCodeVerifier();
  }
  
  /**
   * Clear all Spotify-related storage
   */
  public clearAllStorage(): void {
    this.clearAuthStorage();
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    // Clear any other Spotify-related storage items
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('spotify_auth_return_path');
  }
}