// spotify-browse.service.ts
// Service for browsing and discovering content on Spotify

import { Injectable } from '@angular/core';
import { SpotifyApiService } from './spotify-api.service';
import { LoggerService } from './logger.service';
import { Observable } from 'rxjs';
import { SpotifyTrack, SpotifyArtist, SpotifyAlbum } from '../models/spotify.models';

@Injectable({
  providedIn: 'root'
})
export class SpotifyBrowseService {
  constructor(
    private api: SpotifyApiService,
    private logger: LoggerService
  ) {}
  
  /**
   * Get new album releases
   * 
   * @param limit Number of items to return (max 50)
   */
  async getNewReleases(limit: number = 50): Promise<any> {
    try {
      const safeLimit = Math.max(1, Math.min(50, limit));
      return await this.api.fetchWebApi(`/browse/new-releases?limit=${safeLimit}`);
    } catch (error) {
      this.logger.error("Error fetching new releases:", error);
      throw error;
    }
  }
  
  /**
   * Get an artist's top tracks
   * 
   * @param artistId Spotify artist ID
   * @param market Market code, or 'from_token' to use user's country
   */
  async getArtistTopTracks(
    artistId: string, 
    market: string = 'from_token'
  ): Promise<SpotifyTrack[]> {
    try {
      const response = await this.api.fetchWebApi(`/artists/${artistId}/top-tracks?market=${market}`);
      return response.tracks || [];
    } catch (error) {
      this.logger.error(`Error fetching top tracks for artist ${artistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Search Spotify for tracks, artists, or albums
   * 
   * @param query Search query
   * @param type Type of item to search for: 'track', 'artist', 'album', etc.
   * @param limit Maximum number of results (max 50)
   */
  async search(
    query: string, 
    type: 'track' | 'artist' | 'album' | 'playlist', 
    limit: number = 50
  ): Promise<any> {
    try {
      const safeLimit = Math.max(1, Math.min(50, limit));
      
      const params = new URLSearchParams({
        q: query,
        type: type,
        limit: safeLimit.toString()
      });
      
      const endpoint = `/search?${params.toString()}`;
      this.logger.debug(`Searching Spotify: ${endpoint}`);
      
      return await this.api.fetchWebApi(endpoint);
    } catch (error) {
      this.logger.error(`Search failed for "${query}" (${type}):`, error);
      throw error;
    }
  }
  
  /**
   * Get related artists for a given artist
   * 
   * @param artistId Spotify artist ID
   */
  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    try {
      const response = await this.api.fetchWebApi(`/artists/${artistId}/related-artists`);
      return response.artists || [];
    } catch (error) {
      this.logger.error(`Error fetching related artists for ${artistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get featured playlists
   * 
   * @param limit Number of items to return (max 50)
   * @param offset Offset for pagination
   * @param country Country code (e.g., 'US')
   * @param locale Locale (e.g., 'en_US')
   * @param timestamp ISO timestamp to use for selection
   */
  async getFeaturedPlaylists(
    limit: number = 20,
    offset: number = 0,
    country?: string,
    locale?: string,
    timestamp?: string
  ): Promise<any> {
    try {
      const params: Record<string, string | number> = {
        limit: Math.min(50, Math.max(1, limit)),
        offset
      };
      
      if (country) params['country'] = country;
      if (locale) params['locale'] = locale;
      if (timestamp) params['timestamp'] = timestamp;
      
      const endpoint = this.api.buildUrl('/browse/featured-playlists', params);
      return await this.api.fetchWebApi(endpoint);
    } catch (error) {
      this.logger.error("Error fetching featured playlists:", error);
      throw error;
    }
  }
  
  /**
   * Get artist details
   * 
   * @param artistId Spotify artist ID
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    try {
      return await this.api.fetchWebApi(`/artists/${artistId}`);
    } catch (error) {
      this.logger.error(`Error fetching artist ${artistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get album details
   * 
   * @param albumId Spotify album ID
   * @param market Market code, or 'from_token' to use user's country
   */
  async getAlbum(albumId: string, market: string = 'from_token'): Promise<SpotifyAlbum> {
    try {
      return await this.api.fetchWebApi(`/albums/${albumId}?market=${market}`);
    } catch (error) {
      this.logger.error(`Error fetching album ${albumId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get recommendations based on seed artists, tracks, or genres
   * 
   * @param params Parameters for recommendation
   */
  async getRecommendations(params: {
    seed_artists?: string[];
    seed_tracks?: string[];
    seed_genres?: string[];
    limit?: number;
    market?: string;
    [key: string]: any; // Additional parameters like min_energy, max_popularity, etc.
  }): Promise<any> {
    try {
      const queryParams: Record<string, string | number> = {};
      
      // Process seed parameters
      if (params.seed_artists && params.seed_artists.length > 0) {
        queryParams['seed_artists'] = params.seed_artists.slice(0, 5).join(',');
      }
      
      if (params.seed_tracks && params.seed_tracks.length > 0) {
        queryParams['seed_tracks'] = params.seed_tracks.slice(0, 5).join(',');
      }
      
      if (params.seed_genres && params.seed_genres.length > 0) {
        queryParams['seed_genres'] = params.seed_genres.slice(0, 5).join(',');
      }
      
      // Process limit
      if (params.limit) {
        queryParams['limit'] = Math.min(100, Math.max(1, params.limit));
      } else {
        queryParams['limit'] = 20;
      }
      
      // Add market if specified
      if (params.market) {
        queryParams['market'] = params.market;
      }
      
      // Add all other parameters (like min_energy, max_popularity, etc.)
      for (const [key, value] of Object.entries(params)) {
        if (
          !['seed_artists', 'seed_tracks', 'seed_genres', 'limit', 'market'].includes(key) && 
          value !== undefined && 
          value !== null
        ) {
          queryParams[key] = value;
        }
      }
      
      const endpoint = this.api.buildUrl('/recommendations', queryParams);
      return await this.api.fetchWebApi(endpoint);
    } catch (error) {
      this.logger.error("Error fetching recommendations:", error);
      throw error;
    }
  }
}