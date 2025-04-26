import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { Track } from '../models/track.model';

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  private clientId = environment.spotify.clientId;
  private redirectUri = environment.spotify.redirectUri;
  private authorizationUrl = 'https://accounts.spotify.com/authorize';
  private tokenUrl = 'https://accounts.spotify.com/api/token';
  private apiUrl = 'https://api.spotify.com/v1';
  private token: string | null = null;
  private codeVerifier: string | null = null;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) { 
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Only access localStorage in browser environment
    if (this.isBrowser) {
      this.token = localStorage.getItem('spotify_token');
    }
  }

  // Generate random string for PKCE
  private generateRandomString(length: number): string {
    if (!this.isBrowser) return '';
    
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
      .map(x => possible[x % possible.length])
      .join('');
  }

  // Create code challenge for PKCE
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    if (!this.isBrowser) return '';
    
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  // Start authorization with PKCE
  async authorize(returnPath?:string): Promise<void> {
    if (!this.isBrowser) return;

    // Save the current path to return to after login
    const currentPath = returnPath || window.location.pathname;
    localStorage.setItem('spotify_auth_return_path', currentPath);
    
    // Generate and store PKCE code verifier
    this.codeVerifier = this.generateRandomString(64);
    localStorage.setItem('spotify_code_verifier', this.codeVerifier);

    // Generate code challenge
    const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

    // Generate state
    const state = this.generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);
     
    // Set up auth parameters
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: state,
      scope: 'user-read-private user-read-email'
    });
    window.location.href = `${this.authorizationUrl}?${params.toString()}`;
  }

  // Handle callback for PKCE flow
  async handleCallback(): Promise<boolean> {
    if (!this.isBrowser) return false;    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('spotify_auth_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    if (!code || !state || state !== storedState || !codeVerifier) {
      return false;
    }
    try {
      // Exchange code for token
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

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', await tokenResponse.text());
        return false;
      }
      const tokenData = await tokenResponse.json();
      if (tokenData && tokenData.access_token) {
        this.token = tokenData.access_token;        
        // Store token and expiration
        localStorage.setItem('spotify_token', this.token || '');
        localStorage.setItem('spotify_token_expires', 
          (Date.now() + (tokenData.expires_in || 3600) * 1000).toString());      
      
        if (tokenData.refresh_token) {
          localStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
        }      
        // Clean up
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');      
        return true;
      }    
      console.error('Token data is missing or invalid:', tokenData);
      return false;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      return false;
    }
  }

  // spotify.service.ts
  /* 1. Check if the stored token is still valid */
  private isTokenExpired(): boolean {
    const exp = parseInt(localStorage.getItem('spotify_token_expires') ?? '0', 10);
    return !exp || Date.now() >= exp;
  }

  /* 2. Refresh the token if we still possess a refresh token */
  private async refreshAccessToken(): Promise<void> {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) { this.logout(); return; }

    const body = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString();

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!res.ok) { this.logout(); return; }

    const json = await res.json();
    this.token = json.access_token;
    localStorage.setItem('spotify_token', this.token || '');
    localStorage.setItem(
      'spotify_token_expires',
      (Date.now() + (json.expires_in ?? 3600) * 1000).toString()
    );
  }

  /* 3. Guarantee a usable token for every public-API call */
  private async ensureValidToken(): Promise<void> {
    if (!this.token || this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
  }

  // Search for tracks, artists, or albums
  async search(query: string, type: string): Promise<any> {
    if (!this.isBrowser || !this.token) {
      return { [type + 's']: { items: [] } };
    }
    try {
      const response = await fetch(`${this.apiUrl}/search?q=${query}&type=${type}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear it
          this.token = null;
          localStorage.removeItem('spotify_token');
        }
        throw new Error(`Search failed with status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Search failed: ${error}`);
      return { [type + 's']: { items: [] } };
    }
  }
  // Check if user is logged in
  isLoggedIn(): boolean {
    return this.isBrowser && !!this.token && !this.isTokenExpired();
  }
  // Log out user
  logout(): void {
    if (!this.isBrowser) return;
    
    this.token = null;
    localStorage.removeItem('spotify_token');
  }  
  // Get new releases
  // Update in spotify.service.ts
  async getNewReleases(limit: number = 50): Promise<any> {
    if (!this.isBrowser || !this.token) {
      return { albums: { items: [] } };
    }
    await this.ensureValidToken(); // Ensure token validity before making the call

    try {
      console.log(`Fetching new releases (Spotify) limit: ${limit}`);
      
      const params = new URLSearchParams({
        limit: limit.toString()
      });
      
      const requestUrl = `${this.apiUrl}/browse/new-releases?${params.toString()}`;
      console.log('Request URL:', requestUrl);

      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        // Check for 401 Unauthorized specifically to handle token expiration
        if (response.status === 401) {
           console.error('Authorization failed (401). Token might be expired or invalid.');
           await this.refreshAccessToken(); // Try refreshing
           this.logout(); // Or logout if refresh fails / not implemented for retry
           return { albums: { items: [] } }; // Return empty on auth failure
        }
        // Handle other errors
        const errorText = await response.text();
        console.error(`Get new releases failed with status: ${response.status}`, errorText);
        return { albums: { items: [] } };
      }

      const data = await response.json();
      console.log(`Received ${data.albums?.items?.length || 0} new releases`);
      return data;
    } catch (error) {
      console.error('Error fetching new releases from Spotify:', error);
      return { albums: { items: [] } };
    }
  }
  // Get featured playlists (charts)
  async getFeaturedPlaylists(country?: string, limit: number = 20): Promise<any> {
    if (!this.isBrowser || !this.token) {
      return { playlists: { items: [] } };
    }
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
      });      
      if (country) {
        params.append('country', country);
      }
      const response = await fetch(`${this.apiUrl}/browse/featured-playlists?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to get featured playlists: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching featured playlists:', error);
      return { playlists: { items: [] } };
    }
  }

  // Get playlist details including tracks
  async getPlaylist(playlistId: string): Promise<any> {
    await this.ensureValidToken();
    if (!this.isBrowser || !this.token) {
      return { tracks: { items: [] } };
    }
    try {
      console.log(`Fetching playlist with ID: ${playlistId}`);
      const response = await fetch(`${this.apiUrl}/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        console.error(`Failed to get playlist: ${response.status}`);
        console.error(await response.text());
        throw new Error(`Failed to get playlist: ${response.status}`);
      }
      const data = await response.json();
      console.log('Playlist data received:', data);
      return data;
    } catch (error) {
      console.error('Error fetching playlist:', error);
      return { tracks: { items: [] } };
    }
  }

  // Get specific global or regional charts (using Spotify's featured playlists)
  async getCharts(region: string = 'global'): Promise<Track[]> {
  // For this implementation, we'll look for specific playlist IDs that represent charts
  // These are Spotify's official playlist IDs for various charts (may need to be updated)
  const chartPlaylists: Record<string, string> = {
    global: '37i9dQZEVXbMDoHDwVN2tF',   // Global Top 50
    us: '37i9dQZEVXbLRQDuF5jeBp',       // United States Top 50
    uk: '37i9dQZEVXbLnolsZ8PSNw',       // United Kingdom Top 50
    poland: '37i9dQZEVXbN6itCcaL3Tt',   // Poland Top 50
    germany: '37i9dQZEVXbJiZcmkrIHGU',  // Germany Top 50
    france: '37i9dQZEVXbIPWwFssbupI',   // France Top 50
    italy: '37i9dQZEVXbIQnj7RRhdSX',    // Italy Top 50
    spain: '37i9dQZEVXbNFJfN1Vw8d9',    // Spain Top 50
    netherlands: '37i9dQZEVXbKCF6dqVpDkS', // Netherlands Top 50
    sweden: '37i9dQZEVXbLoATJ81JYXz',   // Sweden Top 50
    australia: '37i9dQZEVXbJPcfkRz0wJ0', // Australia Top 50
    brazil: '37i9dQZEVXbMXbN3EUUhlg',    // Brazil Top 50
    canada: '37i9dQZEVXbKj23U1GF4IR',    // Canada Top 50
    japan: '37i9dQZEVXbKXQ4mDTEBXq',     // Japan Top 50
    mexico: '37i9dQZEVXbO3qyFxbkOE1'     // Mexico Top 50
  };

    const playlistId = chartPlaylists[region] || chartPlaylists['global'];
    console.log(`Fetching chart for region: ${region}, using playlist ID: ${playlistId}`);
    const data = await this.getPlaylist(playlistId);
    
    return (data.tracks?.items ?? []).map((it: any, idx: number) => ({
      position: idx + 1,
      title:  it.track.name,
      artist: it.track.artists[0].name,
      album:  it.track.album.name,
      thumbnail: it.track.album.images.at(-1)?.url,   // 64 px
      url:    it.track.external_urls.spotify
    }));
  }
}