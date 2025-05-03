import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

// Simplified Spotify Artist Object structure
export interface SpotifyArtist {
  id: string;
  name: string;
  uri?: string; 
  external_urls?: SpotifyExternalUrls; // Uses defined interface
  images?: SpotifyImage[];             // Uses defined interface
  genres?: string[];
  popularity?: number; 
  followers?: { href: null; total: number }; 
}

// Simplified Spotify Paging Object structure
export interface SpotifyArtistPagingObject {
    items: SpotifyArtist[];
    next: string | null; // URL for the next page
    cursors?: { after?: string | null }; // Cursor for 'after' param
    limit: number;
    total?: number; // Total may not always be present
    href: string; // URL for the current request
}

export interface SpotifyTrack { 
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtist[];             // Uses defined interface
  album?: SpotifyAlbumSimple;          // Uses defined interface
  external_urls?: SpotifyExternalUrls; // Uses defined interface
  duration_ms?: number;
  explicit?: boolean;
  is_local?: boolean;
  preview_url?: string | null;
}

export interface GeneratedTrackInfo {
  track: SpotifyTrack;
  sourceType: 'playlist' | 'followedArtist' | 'topArtistSeed'; // Type of source
  sourceName: string; // Name of the playlist or artist
}

// Structure for the items returned by /playlists/{id}/tracks
export interface SpotifyPlaylistTrackObject {
  added_at: string | null; // Timestamp or null
  added_by: { id: string } | null; // Simplified user object or null
  is_local: boolean;
  track: SpotifyTrack | null; // The actual track object (can be null for removed tracks?)
  // video_thumbnail?: { url: string | null }; // Optional
}
// Simplified Paging Object specifically for Playlist Tracks
export interface SpotifyPlaylistTrackPagingObject {
  items: SpotifyPlaylistTrackObject[];
  next: string | null; // URL for the next page
  limit: number;
  offset: number;
  total: number; // Total number of tracks in the playlist
  href: string; // URL for the current request
}
// Interface for the specific /me/following response
export interface SpotifyFollowingResponse {
  artists: SpotifyArtistPagingObject;
}

// Interface for simplified playlist object
export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string | null;
  owner: SpotifyOwner;                // Uses defined interface
  tracks: { total: number; href: string };
  images?: SpotifyImage[];             // Uses defined interface
  public?: boolean;
  collaborative?: boolean;
  external_urls?: SpotifyExternalUrls; // Uses defined interface
  uri?: string;
}

export interface SpotifyPagingObject<T> { // Export if needed elsewhere
  items: T[];
  href: string;
  limit: number;
  next: string | null;
  offset?: number;
  previous?: string | null;
  total?: number;
  cursors?: { after?: string | null; before?: string | null }; 
}

export interface SpotifyFollowingResponse { // Export if needed elsewhere
  artists_page: SpotifyPagingObject<SpotifyArtist>;
}

export interface SpotifySavedAlbumObject { // Needed for /me/albums response
  added_at: string;
  album: SpotifyAlbum; // Assuming SpotifyAlbum includes tracks, artists etc. Adjust if needed
}

export interface SpotifyAlbumSimple { 
  id: string;
  name: string;
  uri?: string;
  release_date?: string;
  images?: SpotifyImage[];             // Uses defined interface
  external_urls?: SpotifyExternalUrls; // Uses defined interface
  artists: SpotifyArtist[];            // Uses defined interface
}

export interface SpotifyAlbum { 
  id: string;
  name: string;
  album_type?: 'album' | 'single' | 'compilation'; 
  artists: SpotifyArtist[];             // Uses defined interface
  available_markets?: string[];
  external_urls?: SpotifyExternalUrls; // Uses defined interface
  href?: string; 
  images?: SpotifyImage[];             // Uses defined interface
  release_date?: string;
  release_date_precision?: 'year' | 'month' | 'day';
  total_tracks?: number;
  type?: 'album'; 
  uri?: string;
  popularity?: number;
}

export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyExternalUrls {
  spotify?: string;
}

export interface SpotifyOwner { 
  id: string;
  display_name?: string;
  external_urls?: SpotifyExternalUrls;
}

export type SpotifyUserPlaylistsResponse = SpotifyPagingObject<SpotifyPlaylist>; // Export type alias
export type SpotifyPlaylistTracksResponse = SpotifyPagingObject<SpotifyPlaylistTrackObject>; // Export type alias
export type SpotifySavedAlbumResponse = SpotifyPagingObject<SpotifySavedAlbumObject>;

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  // --- Properties ---
  private clientId = environment.spotify.clientId;
  private redirectUri = environment.spotify.redirectUri;
  private authorizationUrl = 'https://accounts.spotify.com/authorize';
  private tokenUrl = 'https://accounts.spotify.com/api/token';
  public apiUrl = 'https://api.spotify.com/v1'; 
  public token: string | null = null;         
  private codeVerifier: string | null = null;
  public isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.token = localStorage.getItem('spotify_token');
    }
  }

  // --- Core Auth Methods ---
  private generateRandomString(length: number): string {  
    if (!this.isBrowser) return '';     
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
      .map(x => possible[x % possible.length])
      .join(''); }

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

   // Start authorization with PKCE (with Debug Logging)
   async authorize(returnPath?: string): Promise<void> {
    if (!this.isBrowser) {
        console.warn("[Authorize] Skipping: Not in browser environment.");
        return;
    }
    console.log("[Authorize] Starting authorization flow...");

    // 1. Save return path
    const currentPath = returnPath || window.location.pathname;
    localStorage.setItem('spotify_auth_return_path', currentPath);    

    // 2. Generate and store code verifier
    this.codeVerifier = this.generateRandomString(64);
    localStorage.setItem('spotify_code_verifier', this.codeVerifier);
    console.log(`[Authorize] Generated codeVerifier: ${this.codeVerifier}`);   

    // 3. Generate code challenge
    let codeChallenge: string;
    try {
        codeChallenge = await this.generateCodeChallenge(this.codeVerifier);
        console.log(`[Authorize] Generated codeChallenge.`);
    } catch (error) {
         console.error("[Authorize] Failed to generate code challenge:", error);       
         return; 
    }

    // 4. Generate state
    const state = this.generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);
    console.log(`[Authorize] Generated state: ${state}`);
    console.log(`[Authorize] Saved state: ${localStorage.getItem('spotify_auth_state')}`); // Verify save

    // 5. Define scopes
    const scopes = [
      'user-read-private', 'user-read-email', 'user-top-read',
      'user-read-recently-played', 'playlist-read-private',
      'playlist-read-collaborative', 'playlist-modify-public',
      'playlist-modify-private', 'user-follow-read', 
      'user-library-read',     // To read saved albums/tracks
      'user-library-modify',   // To save/remove albums/tracks
      'user-follow-modify'     // To follow/unfollow artists
    ];
    const scopeString = scopes.join(' ');

    // 6. Construct authorization URL parameters
    // Ensure clientId and redirectUri are correctly loaded from environment
    if (!this.clientId || !this.redirectUri) {
        console.error("[Authorize] Missing clientId or redirectUri from environment config!");        
        return;
    }
    const params = new URLSearchParams({
      client_id: this.clientId,           
      response_type: 'code',                 
      redirect_uri: this.redirectUri,     
      code_challenge_method: 'S256',         
      code_challenge: codeChallenge,         
      state: state,                          
      scope: scopeString                     
    });

    // 7. Redirect user
    const authUrl = `${this.authorizationUrl}?${params.toString()}`;
    console.log(`[Authorize] PRE-REDIRECT CHECK: Verifier in storage: ${localStorage.getItem('spotify_code_verifier')}`);
    console.log(`[Authorize] PRE-REDIRECT CHECK: State in storage: ${localStorage.getItem('spotify_auth_state')}`);
    console.log(`[Authorize] Redirecting to Spotify: ${authUrl}`);
    window.location.href = authUrl; 
  }

    // Handle callback for PKCE flow (with Debug Logging)
    async handleCallback(): Promise<boolean> {
      console.log("[HandleCallback] Entered handleCallback method.");
      if (!this.isBrowser) {
        console.warn('[HandleCallback] Skipping: Not in browser environment.');
        return false; // Cannot handle callback outside browser
      }
  
      // 1. Get params from URL
      console.log(`[HandleCallback] Current URL: ${window.location.href}`);
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error'); // Check for errors returned by Spotify
      console.log(`[HandleCallback] URL Params: code=${code}, state=${state}, error=${error}`);
  
      // 2. Check for errors from Spotify
      if (error) {
          console.error(`[HandleCallback] Error returned from Spotify: ${error}`);
          localStorage.removeItem('spotify_auth_state'); // Clean up state if possible
          localStorage.removeItem('spotify_code_verifier');
          return false;
      }
  
      // 3. Retrieve stored state and verifier IMMEDIATELY
      const storedState = localStorage.getItem('spotify_auth_state');
      const codeVerifier = localStorage.getItem('spotify_code_verifier');
      console.log(`[HandleCallback] Retrieved from localStorage: storedState=${storedState}, codeVerifier=${codeVerifier}`);
  
      // 4. Validate state and presence of code/verifier
      if (!code || !state || !storedState || !codeVerifier) {        
         localStorage.removeItem('spotify_auth_state'); 
         localStorage.removeItem('spotify_code_verifier');
        return false;
      }
      if (state !== storedState) {
         console.error(`[HandleCallback] Validation failed: State mismatch. URL state=${state}, Stored state=${storedState}`);
         localStorage.removeItem('spotify_auth_state'); 
         localStorage.removeItem('spotify_code_verifier');
        return false;
      }
      console.log("[HandleCallback] State matched and required params present.");
  
      // 5. Exchange authorization code for tokens
      try {
        console.log("[HandleCallback] Attempting token exchange with codeVerifier:", codeVerifier); // Log verifier being sent
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
            code_verifier: codeVerifier     // Pass the retrieved verifier
          }).toString() 
        });
  
        // 6. Check response status
        const responseBodyText = await tokenResponse.text(); // Read body once for logging/parsing
        if (!tokenResponse.ok) {
          console.error(`[HandleCallback] Token exchange request failed: ${tokenResponse.status}`, responseBodyText);
           localStorage.removeItem('spotify_auth_state');
           localStorage.removeItem('spotify_code_verifier');
          return false;
        }
        console.log("[HandleCallback] Token exchange response received:", responseBodyText);
  
  
        // 7. Parse response and store tokens
        const tokenData = JSON.parse(responseBodyText); // Parse the text body
        if (tokenData && tokenData.access_token) {
          this.token = tokenData.access_token;
          console.log("[HandleCallback] Token received successfully.");
  
          localStorage.setItem('spotify_token', this.token || '');
          localStorage.setItem('spotify_token_expires', (Date.now() + (tokenData.expires_in || 3600) * 1000).toString());
  
          if (tokenData.refresh_token) {
            localStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
            console.log("[HandleCallback] Refresh token stored.");
          } else {
               localStorage.removeItem('spotify_refresh_token'); 
               console.warn("[HandleCallback] No refresh token received.");
          }
  
          // 8. Clean up temporary localStorage items ONLY on success
          console.log("[HandleCallback] Cleaning up auth state and verifier.");
          localStorage.removeItem('spotify_auth_state');
          localStorage.removeItem('spotify_code_verifier');
  
          console.log("[HandleCallback] Token stored, callback successful.");
          return true;
  
        } else {
          console.error('[HandleCallback] Callback failed: Token data missing or invalid in response.', tokenData);
          localStorage.removeItem('spotify_auth_state');
          localStorage.removeItem('spotify_code_verifier');
          return false;
        }
  
      } catch (error) {
        console.error('[HandleCallback] Error during token exchange fetch/parse:', error);
         localStorage.removeItem('spotify_auth_state'); 
         localStorage.removeItem('spotify_code_verifier');
        return false;
      }
    }
  private isTokenExpired(): boolean {
    if (!this.isBrowser) return true;
    const exp = parseInt(localStorage.getItem('spotify_token_expires') ?? '0', 10);
    return !exp || Date.now() >= exp;
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this.isBrowser) return;
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) { this.logout(); console.warn("No refresh token, logging out."); return; }
     const body = new URLSearchParams({
            client_id: this.clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken}).toString();
     try {
         const res = await fetch(this.tokenUrl, { 
            method: 'POST', // Ensure method is POST
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
         });
         if (!res.ok) { this.logout(); console.error("Refresh token failed."); return; }
         const json = await res.json();
         if (json.access_token) {
             this.token = json.access_token;
             localStorage.setItem('spotify_token', this.token || '');
             localStorage.setItem('spotify_token_expires', (Date.now() + (json.expires_in ?? 3600) * 1000).toString());
             console.log("Access token refreshed.");
             // Note: A new refresh token might be issued, Spotify docs are unclear.
             // If issues arise, check if json.refresh_token exists and update localStorage.
         } else {
              console.error("Refresh response missing access_token.");
              this.logout(); // Log out if refresh gives invalid data
         }
     } catch (error) {
         console.error("Error during token refresh:", error);
         this.logout(); // Log out on fetch error during refresh
     }

  }
  public async ensureValidToken(): Promise<void> {
    if (!this.isBrowser) return;
    if (!this.token || this.isTokenExpired()) {
      console.log("Token missing or expired, attempting refresh...");
      await this.refreshAccessToken();
      if (!this.token) {
          console.error("No valid token after refresh attempt."); 
      }
    }
  }

  public isLoggedIn(): boolean {
    return this.isBrowser && !!this.token && !this.isTokenExpired();
  }

  logout(): void {
    if (!this.isBrowser) return;
    this.token = null;
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expires');
    // Optional: Clear other app state
    // Navigate home after logout completes
    if (window.location.pathname !== '/') {
       window.location.href = '/'; 
    } else {
       window.location.reload(); // Reload if already on home
    }
    console.log("User logged out.");
  }

  // --- Generic API Call Helper ---
  private async fetchWebApi<T = any>(endpoint: string, method: string = 'GET', body?: any, retries: number = 3): Promise<T> {
      // 1. Ensure token is valid *before* checking login status for potentially refreshing
      //    (Only call ensureValidToken if we expect to need a token)
      if (!endpoint.includes(this.tokenUrl)) { // Don't try to refresh when getting the token itself
        await this.ensureValidToken();
      }
      
      // 2. Check login status *after* attempting refresh
      if (!this.isLoggedIn() && !endpoint.includes(this.tokenUrl)) { 
          console.error(`fetchWebApi: User not logged in or token invalid for endpoint ${endpoint}.`);
          throw new Error('User not logged in or session expired.'); 
      }

      const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;

      try {
          const res = await fetch(url, {
              method: method,
              headers: {
                  // Token might be null here if called during refresh itself, handle cautiously
                  'Authorization': `Bearer ${this.token}`, 
                  ...(method !== 'GET' && body ? { 'Content-Type': 'application/json' } : {})
              },
              body: body ? JSON.stringify(body) : undefined
          });

          if (!res.ok) {
              // Try to get error message from Spotify
              let errorMsg = `API request failed: ${res.status}`;
              let spotifyError = null;
              try {
                 spotifyError = await res.json();
                 errorMsg += ` - ${spotifyError?.error?.message || 'Unknown Spotify Error'}`;
              } catch (e) { /* Ignore if response body is not JSON */ }

               // Handle specific status codes
               if (res.status === 401 && !url.includes(this.tokenUrl)) { // If unauthorized (and not a token request itself)
                  console.error(`API call failed (${res.status}), likely token expired. Logging out.`);
                  this.logout(); // Log out if token invalid after ensureValidToken attempt
                  throw new Error(`Authorization invalid (401). Please log in again.`);
               }
               if (res.status === 403) { // Forbidden, likely missing scope
                   throw new Error(`Permission Denied (403): ${spotifyError?.error?.message || 'Check required scopes.'}`);
               }
               if (res.status === 429 && retries > 0) {
                const retryAfterHeader = res.headers.get('Retry-After'); // Seconds
                const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2; // Default 2s
                console.warn(`Rate limited (429). Retrying after ${retryAfterSec} seconds... (${retries} retries left)`);
                await delay(retryAfterSec * 1000); // Wait
                return this.fetchWebApi<T>(endpoint, method, body, retries - 1); // Retry
               }
               // For other errors (like 404, 500, etc.)
               throw new Error(errorMsg);
          }

          const contentLength = res.headers.get('content-length');
          if (res.status === 204 || (res.ok && contentLength !== null && parseInt(contentLength, 10) === 0)) {
            console.log(`fetchWebApi: Received status ${res.status} with empty body for ${method} ${endpoint}. Returning null.`);
            return null as T; // Return null for empty responses
        }
        try {
          return await res.json() as T;
        } catch (e) {
          console.error(`fetchWebApi: Failed to parse JSON response for ${method} ${endpoint}`, e);
          throw new Error(`Failed to parse API response as JSON.`); // Throw specific JSON parse error
        }

    } catch (error) {
        console.error(`Error during fetchWebApi call to ${endpoint}:`, error);
        throw error; 
    }
      
  }

  // --- Specific API Methods ---
  async getUserProfile(): Promise<any> {
    console.log("[Service DEBUG] Calling fetchWebApi for /me...");
    try {
      const profileData = await this.fetchWebApi<any>('/me'); // Assuming fetchWebApi returns parsed JSON
      console.log("[Service DEBUG] Received /me response:", JSON.stringify(profileData)); // Log the whole object
      console.log(`[Service DEBUG] Profile ID found in service: ${profileData?.id}`); // Check if ID exists
      return profileData;
    } catch (error) {
        console.error("[Service DEBUG] Error in getUserProfile service method:", error);
        throw error; // Rethrow
    }
  }
  
  async getTopItems(type: 'artists' | 'tracks', time_range: string, limit: number = 20): Promise<any> {
     const safeLimit = Math.max(1, Math.min(50, limit));
     return this.fetchWebApi(`/me/top/${type}?time_range=${time_range}&limit=${safeLimit}`);
  }

  async getRecentlyPlayed(limit: number = 20): Promise<any> {
     const safeLimit = Math.max(1, Math.min(50, limit));
     return this.fetchWebApi(`/me/player/recently-played?limit=${safeLimit}`);
  }

  async getArtistTopTracks(artistId: string, market: string = 'from_token'): Promise<any> {
     return this.fetchWebApi(`/artists/${artistId}/top-tracks?market=${market}`);
  }

  async createPlaylist(userId: string, name: string, description: string = '', isPublic: boolean = true): Promise<any> {
     return this.fetchWebApi(`/users/${userId}/playlists`, 'POST', {
         name: name, public: isPublic, collaborative: false, description: description
     });
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<any> {
     if (!trackUris || trackUris.length === 0) return { snapshot_id: null };
     // TODO: Implement batching if trackUris.length > 100
     const urisToAdd = trackUris.slice(0, 100);
     return this.fetchWebApi(`/playlists/${playlistId}/tracks`, 'POST', { uris: urisToAdd });
  }

  async getNewReleases(limit: number = 50): Promise<any> {
      const safeLimit = Math.max(1, Math.min(50, limit));
      return this.fetchWebApi(`/browse/new-releases?limit=${safeLimit}`);
  }

  
  // --- Methods for User Playlists ---
  /**
   * Fetches the current user's playlists.
   * @param limit Max items per page (1-50)
   * @param offset Starting index
   * @returns Promise<any> Playlist paging object { items: [...], next: '...', ... }
   */
  private async getUserPlaylistsPage(url: string): Promise<SpotifyUserPlaylistsResponse> {
    return this.fetchWebApi(url);
  } 
  async getAllUserPlaylists(): Promise<SpotifyPlaylist[]> { // Returns array of Playlists
    let allPlaylists: SpotifyPlaylist[] = [];
    let nextUrl: string | null = `${this.apiUrl}/me/playlists?limit=50&offset=0`;
    while(nextUrl) {
        try {
           const data = await this.getUserPlaylistsPage(nextUrl);
           allPlaylists = allPlaylists.concat(data?.items || []);
           nextUrl = data?.next;
           if (nextUrl) await delay(100);
        } catch (error) { console.error("Error during user playlist pagination:", error); throw error; }
    }
    return allPlaylists;
  }

  async getAllFollowedArtists(): Promise<any[]> {
    let allArtists: any[] = [];
    let nextUrl: string | null = `${this.apiUrl}/me/following?type=artist&limit=50`; // Start with first page URL

    console.log("Fetching ALL followed artists (pagination)...");
    while (nextUrl) {
        try {
            // Need to use fetch directly or adapt fetchWebApi to handle full URLs and the specific response structure
            if (!this.isLoggedIn()) throw new Error("User not logged in during pagination.");
            await this.ensureValidToken(); // Ensure token fresh for each page

            console.log(`Fetching followed artists page: ${nextUrl}`);
            const response = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${this.token}` } });

            if (!response.ok) {
                // Handle rate limiting within pagination loop
                if (response.status === 429) {
                    const retryAfterHeader = response.headers.get('Retry-After');
                    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;
                    console.warn(`Rate limited fetching followed artists. Retrying after ${retryAfterSec}s...`);
                    await delay(retryAfterSec * 1000);
                    continue; // Retry the same URL
                }
                throw new Error(`Failed to fetch followed artists page: ${response.status}`);
            }
            
            const data: SpotifyFollowingResponse = await response.json();
            const artists = data?.artists?.items || [];
            allArtists = allArtists.concat(artists);
            
            // Get the *next* URL from the response for the next iteration
            nextUrl = data?.artists?.next; 
            if (nextUrl) await delay(100); // Small delay between page requests

        } catch (error) {
            console.error("Error during followed artists pagination:", error);
            // Decide whether to stop or continue (might return partial list)
            nextUrl = null; // Stop pagination on error
            throw error; // Or rethrow error
        }
    }
    console.log(`[Service DEBUG] Returning ${allArtists.length} followed artists from service.`);
    // Log the first few artist names to be sure
    console.log('[Service DEBUG] Sample:', JSON.stringify(allArtists.slice(0, 3).map(a => a.name))); 
    return allArtists;
  }
  
   // getPlaylistTracks with Pagination
  async getAllPlaylistTracks(playlistId: string, market: string = 'from_token'): Promise<SpotifyTrack[]> {
    let allTrackItems: SpotifyPlaylistTrackObject[] = []; // Store the item which contains { track: ... }
    let nextUrl: string | null = `${this.apiUrl}/playlists/${playlistId}/tracks?market=${market}&limit=100&offset=0`; // Max limit is 100

    console.log(`Fetching ALL tracks for playlist ${playlistId} (pagination)...`);
    while(nextUrl) {
        try {
            if (!this.isLoggedIn()) throw new Error("User not logged in during pagination.");
            await this.ensureValidToken();

            console.log(`Fetching tracks page: ${nextUrl}`);
            const response = await fetch(nextUrl, { headers: { 'Authorization': `Bearer ${this.token}` } });

            if (!response.ok) {
               if (response.status === 429) { /* ... rate limit handling ... */ await delay(2000); continue; }
               throw new Error(`Failed to fetch tracks page for playlist ${playlistId}: ${response.status}`);
            }
            const data: SpotifyPlaylistTrackPagingObject  = await response.json();
            allTrackItems = allTrackItems.concat(data?.items || []);
            nextUrl = data?.next; // Get next URL
            if (nextUrl) await delay(100);

        } catch (error) {
            console.error(`Error during playlist track pagination for ${playlistId}:`, error);
            nextUrl = null; // Stop on error
            throw error; 
        }
    }
    console.log(`Finished fetching. Total track items for playlist ${playlistId}: ${allTrackItems.length}`);
    // Return only the track objects, filtering out potential nulls
    return allTrackItems.map(item => item?.track).filter((track): track is SpotifyTrack => track !== null && track !== undefined); 
  }

   // Search for tracks, artists, or albums
  async search(query: string, type: string, limit: number = 50): Promise<any> {
    if (!this.isBrowser || !this.token) {
      return { [type + 's']: { items: [] } };
    }
    const safeLimit = Math.max(1, Math.min(50, limit));
    try {
      // Use URLSearchParams for robustness
      const params = new URLSearchParams({
          q: query,
          type: type,
          limit: safeLimit.toString() // Pass the limit
      });
      const endpoint = `/search?${params.toString()}`;
      console.log(`Searching Spotify: ${this.apiUrl}${endpoint}`);
      return await this.fetchWebApi<any>(endpoint); 
    } catch (error) {
      console.error(`Search failed: ${error}`);
      return { [type + 's']: { items: [] } };
    }
  } 

   // --- Library Read Methods (with Pagination) ---
  private async getSavedAlbumsPage(url: string): Promise<SpotifySavedAlbumResponse> {
    return this.fetchWebApi<SpotifySavedAlbumResponse>(url);
  }
  async getAllSavedAlbums(): Promise<SpotifySavedAlbumObject[]> {
    let allItems: SpotifySavedAlbumObject[] = [];
    let nextUrl: string | null = `${this.apiUrl}/me/albums?limit=50&offset=0`;
    console.log("Fetching ALL saved albums (pagination)...");
    while (nextUrl) {
        try {
            const data = await this.getSavedAlbumsPage(nextUrl);
            allItems = allItems.concat(data?.items || []);
            nextUrl = data?.next;
            if (nextUrl) await delay(100);
        } catch (error) { console.error("Error during saved albums pagination:", error); throw error; }
    }
    console.log(`Finished fetching. Total saved album items: ${allItems.length}`);
    return allItems;
  }

  // --- Library Modify Methods ---

  /**
   * Unfollows one or more artists.
   * Requires scope: user-follow-modify
   */
  async unfollowArtist(artistId: string): Promise<void> {
      // Note: API takes comma-separated list, but let's do one at a time for simplicity
      await this.fetchWebApi(`/me/following?type=artist&ids=${artistId}`, 'DELETE');
      console.log(`Unfollowed artist: ${artistId}`);
  }

  /**
   * Removes one or more albums from the user's library.
   * Requires scope: user-library-modify
   */
  async unsaveAlbum(albumId: string): Promise<void> {
      await this.fetchWebApi(`/me/albums?ids=${albumId}`, 'DELETE');
      console.log(`Unsaved album: ${albumId}`);
  }

  /**
   * Unfollows a playlist (removes from library).
   * Requires scope: playlist-modify-public or playlist-modify-private
   */
  async unfollowPlaylist(playlistId: string): Promise<void> {
      // This is the endpoint to make the current user unfollow
      await this.fetchWebApi(`/playlists/${playlistId}/followers`, 'DELETE');
      console.log(`Unfollowed playlist: ${playlistId}`);
      // Note: This doesn't delete playlists the user owns.
  }

  /**
   * Follows one or more artists.
   * Requires scope: user-follow-modify
   */
  async followArtist(artistId: string): Promise<void> {
      await this.fetchWebApi(`/me/following?type=artist&ids=${artistId}`, 'PUT');
      console.log(`Followed artist: ${artistId}`);
  }

  /**
   * Saves one or more albums to the user's library.
   * Requires scope: user-library-modify
   */
  async saveAlbum(albumId: string): Promise<void> {
      await this.fetchWebApi(`/me/albums?ids=${albumId}`, 'PUT');
      console.log(`Saved album: ${albumId}`);
  }

  /**
   * Follows (saves) a playlist.
   * Requires scope: playlist-modify-public or playlist-modify-private
   * @param makePublic Whether to make the followed playlist public on the user's profile (default true)
   */
  async followPlaylist(playlistId: string, makePublic: boolean = true): Promise<void> {
        // Note: Body determines if it's publicly visible on user profile
      await this.fetchWebApi(`/playlists/${playlistId}/followers`, 'PUT', { public: makePublic });
      console.log(`Followed playlist: ${playlistId}`);
  }

}