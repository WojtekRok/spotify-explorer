// Main facade service for Spotify API integration

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  LoggerService,
  SpotifyAuthService,
  SpotifyApiService,
  SpotifyUserService,
  SpotifyLibraryService,
  SpotifyBrowseService,
  SpotifyUserProfile, 
  SpotifyTrack, 
  SpotifyArtist, 
  SpotifyPlaylist,
  SpotifyArtistAlbum, 
  SpotifyAlbum, 
  SpotifySavedAlbumObject 
} from './';

/**
 * Main Spotify service that acts as a facade for all Spotify interactions
 * - Provides a simple interface to the application
 * - Delegates to specialized services
 */
@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  // Expose key URLs for components that need them
  public readonly apiUrl = 'https://api.spotify.com/v1';
  
  // User profile cache
  private _userProfile$ = new BehaviorSubject<SpotifyUserProfile | null>(null);
  public userProfile$ = this._userProfile$.asObservable();

  constructor(
    private authService: SpotifyAuthService,
    private apiService: SpotifyApiService,
    private userService: SpotifyUserService,
    private libraryService: SpotifyLibraryService,
    private browseService: SpotifyBrowseService,
    private logger: LoggerService
  ) {
    // Load user profile when token is available
    this.authService.token$.subscribe(token => {
      if (token) {
        this.loadUserProfile();
      } else {
        this._userProfile$.next(null);
      }
    });
  }

  // --- Auth Methods ---
  
  /**
   * Start the authorization flow
   */
  public authorize(returnPath?: string): void {
    return this.authService.authorize(returnPath);
  }
  
  /**
   * Handle the callback from Spotify authorization
   */
  public handleCallback(): Promise<boolean> {
    return this.authService.handleCallback();
  }
  
  /**
   * Check if user is logged in
   */
  public isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }
  
  /**
   * Get isLoggedIn as Observable
   */
  public get isLoggedIn$(): Observable<boolean> {
    return this.authService.isLoggedIn$;
  }
  
  /**
   * Logout user
   */
  public logout(): void {
    this.authService.logout();
  }
  
  // --- User Profile ---
  
  /**
   * Load user profile
   */
  private async loadUserProfile(): Promise<void> {
    try {
      const profile = await this.userService.getUserProfile();
      this._userProfile$.next(profile);
    } catch (error) {
      this.logger.error('Failed to load user profile:', error);
    }
  }
  
  /**
   * Get current user profile
   */
  public getUserProfile(): Promise<SpotifyUserProfile> {
    return this.userService.getUserProfile();
  }
  
  // --- User Top Items ---
  
  /**
   * Get user's top tracks
   */
  public getTopTracks(timeRange?: 'short_term' | 'medium_term' | 'long_term', limit?: number): Promise<SpotifyTrack[]> {
    return this.userService.getTopTracks(timeRange, limit);
  }
  
  /**
   * Get user's top artists
   */
  public getTopArtists(timeRange?: 'short_term' | 'medium_term' | 'long_term', limit?: number): Promise<SpotifyArtist[]> {
    return this.userService.getTopArtists(timeRange, limit);
  }
  
  /**
   * Get recently played tracks
   */
  public getRecentlyPlayed(limit?: number): Promise<any> {
    return this.userService.getRecentlyPlayed(limit);
  }
  
  // --- Browse & Search ---
  
  /**
   * Get new releases
   */
  public getNewReleases(limit?: number): Promise<any> {
    return this.browseService.getNewReleases(limit);
  }
  
  /**
   * Get artist's top tracks
   */
  public getArtistTopTracks(artistId: string, market?: string): Promise<SpotifyTrack[]> {
    return this.browseService.getArtistTopTracks(artistId, market);
  }
  
  /**
   * Get related artists
   */
  public getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    return this.browseService.getRelatedArtists(artistId);
  }
  
  /**
   * Search Spotify
   */
  public search(
    query: string, 
    type: 'track' | 'artist' | 'album' | 'playlist', 
    limit?: number
  ): Promise<any> {
    return this.browseService.search(query, type, limit);
  }
  
  /**
   * Get recommendations
   */
  public getRecommendations(params: any): Promise<any> {
    return this.browseService.getRecommendations(params);
  }
  
  // --- Library Methods ---
  
  /**
   * Get all user playlists
   */
  public getAllUserPlaylists(): Promise<SpotifyPlaylist[]> {
    return this.libraryService.getAllUserPlaylists();
  }
  
  /**
   * Get all tracks from a playlist
   */
  public getAllPlaylistTracks(playlistId: string, market?: string): Promise<SpotifyTrack[]> {
    return this.libraryService.getAllPlaylistTracks(playlistId, market);
  }
  
  /**
   * Get all followed artists
   */
  public getAllFollowedArtists(): Promise<SpotifyArtist[]> {
    return this.libraryService.getAllFollowedArtists();
  }
  
  /**
   * Get all saved albums
   */
  public getAllSavedAlbums(): Promise<SpotifySavedAlbumObject[]> {
    return this.libraryService.getAllSavedAlbums();
  }
  
  /**
   * Get all albums for an artist
   */
  public getAllArtistAlbums(
    artistId: string, 
    includeGroups?: string, 
    market?: string
  ): Promise<SpotifyArtistAlbum[]> {
    return this.libraryService.getAllArtistAlbums(artistId, includeGroups, market);
  }
  
  /**
   * Get all tracks from an album
   */
  public getAllAlbumTracks(albumId: string, market?: string): Promise<any> {
    return this.libraryService.getAllAlbumTracks(albumId, market);
  }
  
  // --- Playlist Management ---
  
  /**
   * Create a new playlist
   */
  public createPlaylist(
    name: string, 
    description?: string, 
    isPublic?: boolean
  ): Promise<SpotifyPlaylist> {
    return this.userService.createPlaylist(name, description, isPublic);
  }
  
  /**
   * Add tracks to a playlist
   */
  public addTracksToPlaylist(
    playlistId: string, 
    trackUris: string[]
  ): Promise<{ snapshot_id: string }> {
    return this.userService.addTracksToPlaylist(playlistId, trackUris);
  }
  
  // --- Library Management ---
  
  /**
   * Follow an artist
   */
  public followArtist(artistId: string): Promise<void> {
    return this.libraryService.followArtist(artistId);
  }
  
  /**
   * Unfollow an artist
   */
  public unfollowArtist(artistId: string): Promise<void> {
    return this.libraryService.unfollowArtist(artistId);
  }
  
  /**
   * Save an album
   */
  public saveAlbum(albumId: string): Promise<void> {
    return this.libraryService.saveAlbum(albumId);
  }
  
  /**
   * Unsave an album
   */
  public unsaveAlbum(albumId: string): Promise<void> {
    return this.libraryService.unsaveAlbum(albumId);
  }
  
  /**
   * Follow a playlist
   */
  public followPlaylist(playlistId: string, makePublic?: boolean): Promise<void> {
    return this.libraryService.followPlaylist(playlistId, makePublic);
  }
  
  /**
   * Unfollow a playlist
   */
  public unfollowPlaylist(playlistId: string): Promise<void> {
    return this.libraryService.unfollowPlaylist(playlistId);
  }
  
  // --- Direct API Access ---
  
  /**
   * Low-level API access for custom requests
   * Use this for specialized operations not covered by helper methods
   */
  public fetchWebApi<T = any>(
    endpoint: string, 
    method: string = 'GET', 
    body?: any
  ): Promise<T> {
    return this.apiService.fetchWebApi(endpoint, method, body);
  }
}