// Service for accessing user's Spotify library (playlists, saved items, followed artists)

import { Injectable } from '@angular/core';
import { SpotifyApiService } from './spotify-api.service';
import { LoggerService } from './logger.service';
import { Observable, from } from 'rxjs';
import { 
  SpotifyArtist, SpotifyPlaylist, SpotifyFollowingResponse, 
  SpotifyPagingObject, SpotifyPlaylistTrackObject, SpotifyTrack,
  SpotifySavedAlbumObject, SpotifyAlbum, SpotifyArtistAlbum, SpotifyAlbumTrack
} from '../models/spotify.models';

@Injectable({
  providedIn: 'root'
})
export class SpotifyLibraryService {
  constructor(
    private api: SpotifyApiService,
    private logger: LoggerService
  ) {}
  
  // --- User Playlists ---
  
  /**
   * Gets all playlists for the current user
   */
  async getAllUserPlaylists(): Promise<SpotifyPlaylist[]> {
    this.logger.log("Fetching ALL user playlists...");
    
    const initialUrl = '/me/playlists?limit=50&offset=0';
    
    try {
      return await this.api.fetchAllPages<SpotifyPlaylist, SpotifyPagingObject<SpotifyPlaylist>>(
        initialUrl,
        (response) => response.items || [],
        (response) => response.next
      );
    } catch (error) {
      this.logger.error("Error fetching user playlists:", error);
      throw error;
    }
  }
  
  /**
   * Gets playlists as an Observable
   */
  getUserPlaylists(): Observable<SpotifyPagingObject<SpotifyPlaylist>> {
    return this.api.getWebApi<SpotifyPagingObject<SpotifyPlaylist>>('/me/playlists?limit=50');
  }
  
  // --- Playlist Tracks ---
  
  /**
   * Gets all tracks from a playlist
   */
  async getAllPlaylistTracks(playlistId: string, market: string = 'from_token'): Promise<SpotifyTrack[]> {
    this.logger.log(`Fetching ALL tracks for playlist ${playlistId}...`);
    
    const initialUrl = `/playlists/${playlistId}/tracks?market=${market}&limit=100&offset=0`;
    
    try {
      const trackObjects = await this.api.fetchAllPages<SpotifyPlaylistTrackObject, SpotifyPagingObject<SpotifyPlaylistTrackObject>>(
        initialUrl,
        (response) => response.items || [],
        (response) => response.next
      );
      
      // Filter out null tracks and extract track object
      return trackObjects
        .map(item => item?.track)
        .filter((track): track is SpotifyTrack => track !== null && track !== undefined);
    } catch (error) {
      this.logger.error(`Error fetching tracks for playlist ${playlistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Gets all playlist track objects (includes metadata like added_at)
   */
  async getAllPlaylistTrackObjects(playlistId: string, market: string = 'from_token'): Promise<SpotifyPlaylistTrackObject[]> {
    this.logger.log(`Fetching ALL track objects for playlist ${playlistId}...`);
    
    const initialUrl = `/playlists/${playlistId}/tracks?market=${market}&limit=100&offset=0`;
    
    try {
      return await this.api.fetchAllPages<SpotifyPlaylistTrackObject, SpotifyPagingObject<SpotifyPlaylistTrackObject>>(
        initialUrl,
        (response) => response.items || [],
        (response) => response.next
      );
    } catch (error) {
      this.logger.error(`Error fetching track objects for playlist ${playlistId}:`, error);
      throw error;
    }
  }

  // --- Followed Artists ---
  
  /**
   * Gets all artists followed by the current user
   */
  async getAllFollowedArtists(): Promise<SpotifyArtist[]> {
    this.logger.log("Fetching ALL followed artists...");
    
    const initialUrl = '/me/following?type=artist&limit=50';
    
    try {
      return await this.api.fetchAllPages<SpotifyArtist, SpotifyFollowingResponse>(
        initialUrl,
        (response) => response.artists?.items || [],
        (response) => response.artists?.next || null
      );
    } catch (error) {
      this.logger.error("Error fetching followed artists:", error);
      throw error;
    }
  }
  
  // --- Albums ---
  
  /**
   * Gets all saved albums in the user's library
   */
  async getAllSavedAlbums(): Promise<SpotifySavedAlbumObject[]> {
    this.logger.log("Fetching ALL saved albums...");
    
    const initialUrl = '/me/albums?limit=50&offset=0';
    
    try {
      return await this.api.fetchAllPages<SpotifySavedAlbumObject, SpotifyPagingObject<SpotifySavedAlbumObject>>(
        initialUrl,
        (response) => response.items || [],
        (response) => response.next
      );
    } catch (error) {
      this.logger.error("Error fetching saved albums:", error);
      throw error;
    }
  }
  
  /**
   * Gets all albums for a specific artist
   */
  async getAllArtistAlbums(
    artistId: string, 
    includeGroups: string = 'album,single', 
    market: string = 'from_token'
  ): Promise<SpotifyArtistAlbum[]> {
    this.logger.log(`Fetching ALL albums for artist ${artistId}...`);
    
    const params = {
      include_groups: includeGroups,
      market: market,
      limit: 50,
      offset: 0
    };
    
    const initialUrl = this.api.buildUrl(`/artists/${artistId}/albums`, params);
    
    try {
      return await this.api.fetchAllPages<SpotifyArtistAlbum, SpotifyPagingObject<SpotifyArtistAlbum>>(
        initialUrl,
        (response) => response.items || [],
        (response) => response.next
      );
    } catch (error) {
      this.logger.error(`Error fetching albums for artist ${artistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Gets all tracks for a specific album
   */
  async getAllAlbumTracks(albumId: string, market: string = 'from_token'): Promise<SpotifyAlbumTrack[]> {
    this.logger.log(`Fetching ALL tracks for album ${albumId}...`);
    
    const initialUrl = `/albums/${albumId}/tracks?market=${market}&limit=50&offset=0`;
    
    try {
      return await this.api.fetchAllPages<SpotifyAlbumTrack, SpotifyPagingObject<SpotifyAlbumTrack>>(
        initialUrl,
        (response) => response.items || [],
        (response) => response.next
      );
    } catch (error) {
      this.logger.error(`Error fetching tracks for album ${albumId}:`, error);
      throw error;
    }
  }
  
  // --- Library Management ---
  
  /**
   * Follows a specific artist
   */
  async followArtist(artistId: string): Promise<void> {
    try {
      await this.api.fetchWebApi(`/me/following?type=artist&ids=${artistId}`, 'PUT');
      this.logger.log(`Followed artist: ${artistId}`);
    } catch (error) {
      this.logger.error(`Error following artist ${artistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Unfollows a specific artist
   */
  async unfollowArtist(artistId: string): Promise<void> {
    try {
      await this.api.fetchWebApi(`/me/following?type=artist&ids=${artistId}`, 'DELETE');
      this.logger.log(`Unfollowed artist: ${artistId}`);
    } catch (error) {
      this.logger.error(`Error unfollowing artist ${artistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Saves album to user's library
   */
  async saveAlbum(albumId: string): Promise<void> {
    try {
      await this.api.fetchWebApi(`/me/albums?ids=${albumId}`, 'PUT');
      this.logger.log(`Saved album: ${albumId}`);
    } catch (error) {
      this.logger.error(`Error saving album ${albumId}:`, error);
      throw error;
    }
  }
  
  /**
   * Removes album from user's library
   */
  async unsaveAlbum(albumId: string): Promise<void> {
    try {
      await this.api.fetchWebApi(`/me/albums?ids=${albumId}`, 'DELETE');
      this.logger.log(`Unsaved album: ${albumId}`);
    } catch (error) {
      this.logger.error(`Error unsaving album ${albumId}:`, error);
      throw error;
    }
  }
  
  /**
   * Follows (saves) a playlist
   */
  async followPlaylist(playlistId: string, makePublic: boolean = true): Promise<void> {
    try {
      await this.api.fetchWebApi(`/playlists/${playlistId}/followers`, 'PUT', { public: makePublic });
      this.logger.log(`Followed playlist: ${playlistId}`);
    } catch (error) {
      this.logger.error(`Error following playlist ${playlistId}:`, error);
      throw error;
    }
  }
  
  /**
   * Unfollows a playlist
   */
  async unfollowPlaylist(playlistId: string): Promise<void> {
    try {
      await this.api.fetchWebApi(`/playlists/${playlistId}/followers`, 'DELETE');
      this.logger.log(`Unfollowed playlist: ${playlistId}`);
    } catch (error) {
      this.logger.error(`Error unfollowing playlist ${playlistId}:`, error);
      throw error;
    }
  }
}