// spotify-user.service.ts
// Service for accessing user profile and user-specific data

import { Injectable } from '@angular/core';
import { SpotifyApiService } from './spotify-api.service';
import { LoggerService } from './logger.service';
import { Observable, from } from 'rxjs';
import { 
  SpotifyUserProfile, SpotifyTrack, SpotifyArtist, 
  SpotifyPagingObject, SpotifyPlaylist
} from '../models/spotify.models';
import { catchError, map } from 'rxjs/operators';

/**
 * Valid time ranges for "top items" API
 */
export type TopItemsTimeRange = 'short_term' | 'medium_term' | 'long_term';

@Injectable({
  providedIn: 'root'
})
export class SpotifyUserService {
  constructor(
    private api: SpotifyApiService,
    private logger: LoggerService
  ) {}
  
  /**
   * Get current user profile
   */
  async getUserProfile(): Promise<SpotifyUserProfile> {
    try {
      return await this.api.fetchWebApi<SpotifyUserProfile>('/me');
    } catch (error) {
      this.logger.error("Error fetching user profile:", error);
      throw error;
    }
  }
  
  /**
   * Get current user profile as Observable
   */
  getUserProfileObservable(): Observable<SpotifyUserProfile> {
    return this.api.getWebApi<SpotifyUserProfile>('/me');
  }
  
  /**
   * Get user's top tracks
   * 
   * @param timeRange time period: short_term (4 weeks), medium_term (6 months), long_term (all time)
   * @param limit number of items to return (max 50)
   */
  async getTopTracks(
    timeRange: TopItemsTimeRange = 'medium_term', 
    limit: number = 20
  ): Promise<SpotifyTrack[]> {
    try {
      const safeLimit = Math.max(1, Math.min(50, limit));
      
      const response = await this.api.fetchWebApi<SpotifyPagingObject<SpotifyTrack>>(
        `/me/top/tracks?time_range=${timeRange}&limit=${safeLimit}`
      );
      
      return response.items || [];
    } catch (error) {
      this.logger.error(`Error fetching top tracks (${timeRange}):`, error);
      throw error;
    }
  }
  
  /**
   * Get user's top artists
   * 
   * @param timeRange time period: short_term (4 weeks), medium_term (6 months), long_term (all time)
   * @param limit number of items to return (max 50)
   */
  async getTopArtists(
    timeRange: TopItemsTimeRange = 'medium_term', 
    limit: number = 20
  ): Promise<SpotifyArtist[]> {
    try {
      const safeLimit = Math.max(1, Math.min(50, limit));
      
      const response = await this.api.fetchWebApi<SpotifyPagingObject<SpotifyArtist>>(
        `/me/top/artists?time_range=${timeRange}&limit=${safeLimit}`
      );
      
      return response.items || [];
    } catch (error) {
      this.logger.error(`Error fetching top artists (${timeRange}):`, error);
      throw error;
    }
  }
  
  /**
   * Get user's recently played tracks
   * 
   * @param limit number of items to return (max 50)
   */
  async getRecentlyPlayed(limit: number = 20): Promise<any> {
    try {
      const safeLimit = Math.max(1, Math.min(50, limit));
      
      return await this.api.fetchWebApi(`/me/player/recently-played?limit=${safeLimit}`);
    } catch (error) {
      this.logger.error("Error fetching recently played tracks:", error);
      throw error;
    }
  }
  
  /**
   * Creates a new playlist for the current user
   * 
   * @param name Name of the playlist
   * @param description Optional description
   * @param isPublic Whether the playlist should be public
   */
  async createPlaylist(
    name: string, 
    description: string = '', 
    isPublic: boolean = true
  ): Promise<SpotifyPlaylist> {
    try {
      const userProfile = await this.getUserProfile();
      
      return await this.api.fetchWebApi(
        `/users/${userProfile.id}/playlists`, 
        'POST', 
        {
          name: name,
          public: isPublic,
          collaborative: false,
          description: description
        }
      );
    } catch (error) {
      this.logger.error(`Error creating playlist "${name}":`, error);
      throw error;
    }
  }
  
  /**
   * Adds tracks to a playlist
   * 
   * @param playlistId ID of the playlist
   * @param trackUris Array of Spotify track URIs to add
   */
  async addTracksToPlaylist(
    playlistId: string, 
    trackUris: string[]
  ): Promise<{ snapshot_id: string }> {
    if (!trackUris || trackUris.length === 0) {
      return { snapshot_id: '' };
    }
    
    try {
      // Spotify API limits to 100 tracks per request
      const urisToAdd = trackUris.slice(0, 100);
      
      return await this.api.fetchWebApi(
        `/playlists/${playlistId}/tracks`, 
        'POST', 
        { uris: urisToAdd }
      );
    } catch (error) {
      this.logger.error(`Error adding tracks to playlist ${playlistId}:`, error);
      throw error;
    }
  }
}