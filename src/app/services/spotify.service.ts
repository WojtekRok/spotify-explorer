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
  sourceType: 'playlist' | 'followedArtistAlbum' | 'followedArtistTopTrack' | 'topArtistSeed'; // Type of source
  sourceName: string; // Name of the playlist or artist
  sourceAlbumName?: string;
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
  images?: SpotifyImage[];             
  external_urls?: SpotifyExternalUrls; 
  artists: SpotifyArtist[];
  album_type?: string;            
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

export interface SpotifyArtistAlbum {
  id: string; 
  name: string; 
  album_group: 'album' | 'single' | 'compilation' | 'appears_on';
  album_type: 'album' | 'single' | 'compilation'; 
  release_date?: string; 
  release_date_precision?: string;
  total_tracks?: number; 
  images?: SpotifyImage[]; 
  uri?: string; 
  artists: SpotifyArtist[]; // Simplified artist here? Check API
}
// Interfaces specifically for album's tracks endpoint
export interface SpotifyAlbumTrack { // Often simpler than full track
  id: string; 
  name: string; 
  uri: string; 
  artists: SpotifyArtist[]; // Check actual artist structure here
  disc_number?: number; 
  duration_ms?: number; 
  explicit?: boolean;
  preview_url?: string | null; 
  track_number?: number; 
  is_local?: boolean;
}

export type SpotifyUserPlaylistsResponse = SpotifyPagingObject<SpotifyPlaylist>; // Export type alias
export type SpotifyPlaylistTracksResponse = SpotifyPagingObject<SpotifyPlaylistTrackObject>; // Export type alias
export type SpotifySavedAlbumResponse = SpotifyPagingObject<SpotifySavedAlbumObject>;
export type SpotifyArtistAlbumsResponse = SpotifyPagingObject<SpotifyArtistAlbum>;
export type SpotifyAlbumTracksResponse = SpotifyPagingObject<SpotifyAlbumTrack>;

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
    if (window.location.pathname !== '/') {
       window.location.href = '/'; 
    } else {
       window.location.reload(); // Reload if already on home
    }
    console.log("User logged out.");
  }
  
  private async fetchWebApi<T = any>(endpoint: string, method: string = 'GET', body?: any, retries: number = 3): Promise<T> {    
    await this.ensureValidToken();
    if (!this.isLoggedIn() && !endpoint.includes(this.tokenUrl)) {
      throw new Error('User not logged in.');
    }
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;
    try {
      const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${this.token}`, ...(method !== 'GET' && body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { 
        if (res.status === 429 && retries > 0) { 
          const retryAfterSec = parseInt(res.headers.get('Retry-After') || '2', 10); 
          console.warn(`Rate limited (429). Retrying after ${retryAfterSec}s...`); 
          await delay(retryAfterSec * 1000); 
          return this.fetchWebApi<T>(endpoint, method, body, retries - 1); 
        } 
        let errorMsg = `API request failed: ${res.status}`; 
        try { 
          const errBody = await res.json(); 
          errorMsg += ` - ${errBody?.error?.message || 'Unknown'}`; 
        } catch (e) { } 
        if (res.status === 401 && !url.includes(this.tokenUrl)) { 
          this.logout(); throw new Error(`Authorization invalid (401).`); 
        } 
        if (res.status === 403) { 
          throw new Error(`Permission Denied (403).`); 
        } 
        throw new Error(errorMsg); 
      }
      const contentLength = res.headers.get('content-length'); 
      if (res.status === 204 || (contentLength !== null && parseInt(contentLength, 10) === 0)) {
        return null as T; 
      }
      try { 
        return await res.json() as T; 
      } catch (e) { 
        throw new Error(`Failed to parse API response as JSON.`); 
      }
    } catch (error) { 
      console.error(`Error during fetchWebApi call to ${endpoint}:`, error); throw error; 
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

  // --- PAGINATED LIBRARY METHODS ---
  async getAllFollowedArtists(): Promise<SpotifyArtist[]> {
    let allItems: SpotifyArtist[] = [];
    let url: string | null = `${this.apiUrl}/me/following?type=artist&limit=50`; // Start URL
    console.log("Fetching ALL followed artists (pagination)...");
    while (url) {
        try {
            // Need specific type for this endpoint's paging object
            const data: SpotifyFollowingResponse = await this.fetchWebApi<SpotifyFollowingResponse>(url); 
            allItems = allItems.concat(data?.artists?.items || []);
            url = data?.artists?.next; // Get the next URL
            if (url) await delay(100); // Be nice to the API
        } catch (error) { console.error("Error during followed artists pagination:", error); url = null; throw error; } // Stop on error
    }
    console.log(`Finished fetching followed artists. Total: ${allItems.length}`);
    return allItems;
  }

  async getAllUserPlaylists(): Promise<SpotifyPlaylist[]> {
    let allItems: SpotifyPlaylist[] = [];
    let url: string | null = `${this.apiUrl}/me/playlists?limit=50&offset=0`;
    console.log("Fetching ALL user playlists (pagination)...");
    while(url) {
        try {
           const data: SpotifyUserPlaylistsResponse = await this.fetchWebApi<SpotifyUserPlaylistsResponse>(url); 
           allItems = allItems.concat(data?.items || []);
           url = data?.next; 
           if (url) await delay(100);
        } catch (error) { console.error("Error during user playlist pagination:", error); url = null; throw error; }
    }
    console.log(`Finished fetching playlists. Total: ${allItems.length}`);
    return allItems;
  }

   // Gets all albums/singles for ONE artist (paginated)
  async getAllArtistAlbums(artistId: string, includeGroups: string = 'album,single', market: string = 'from_token'): Promise<SpotifyArtistAlbum[]> {
    let allItems: SpotifyArtistAlbum[] = [];
    let url: string | null = `${this.apiUrl}/artists/${artistId}/albums?include_groups=${includeGroups}&market=${market}&limit=50&offset=0`;
    console.log(`Fetching ALL albums/singles for artist ${artistId} (pagination)...`);
     while(url) {
       try {
          const data: SpotifyArtistAlbumsResponse = await this.fetchWebApi<SpotifyArtistAlbumsResponse>(url); // Use specific paging type
          allItems = allItems.concat(data?.items || []);
          url = data?.next; 
          if (url) await delay(100);
       } catch (error) { console.error(`Error during artist album pagination for ${artistId}:`, error); url = null; throw error; }
   }
    console.log(`Finished fetching albums/singles for artist ${artistId}. Total: ${allItems.length}`);
   return allItems;
  }

  // Gets all tracks for ONE album (paginated)
  async getAllAlbumTracks(albumId: string, market: string = 'from_token'): Promise<SpotifyAlbumTrack[]> {
   let allItems: SpotifyAlbumTrack[] = [];
   let url: string | null = `${this.apiUrl}/albums/${albumId}/tracks?market=${market}&limit=50&offset=0`; // Album tracks limit is 50
   console.log(`Fetching ALL tracks for album ${albumId} (pagination)...`);
   while(url) {
       try {
          console.log(`Fetching album tracks page: ${url}`);
           const data: SpotifyAlbumTracksResponse = await this.fetchWebApi<SpotifyAlbumTracksResponse>(url); // Use specific paging type
           allItems = allItems.concat(data?.items || []);
           url = data?.next; 
           if (url) await delay(100);
       } catch (error) { console.error(`Error during album track pagination for ${albumId}:`, error); url = null; throw error; }
   }
    console.log(`Finished fetching tracks for album ${albumId}. Total: ${allItems.length}`);
   return allItems;
  }

  // Gets all tracks for ONE playlist (paginated) - Renamed from previous version
  async getAllPlaylistTrackObjects(playlistId: string, market: string = 'from_token'): Promise<SpotifyPlaylistTrackObject[]> {
   let allItems: SpotifyPlaylistTrackObject[] = [];
   let url: string | null = `${this.apiUrl}/playlists/${playlistId}/tracks?market=${market}&limit=100&offset=0`; // Playlist tracks limit 100
   console.log(`Fetching ALL track items for playlist ${playlistId} (pagination)...`);
   while(url) {
       try {
           const data: SpotifyPlaylistTracksResponse   = await this.fetchWebApi<SpotifyPlaylistTracksResponse>(url); // Use specific paging type
           allItems = allItems.concat(data?.items || []);
           url = data?.next;
           if (url) await delay(100);
       } catch (error) { console.error(`Error during playlist track pagination for ${playlistId}:`, error); url = null; throw error; }
   }
   console.log(`Finished fetching track items for playlist ${playlistId}. Total: ${allItems.length}`);
   // Return the items containing { track: ... }
   return allItems;
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