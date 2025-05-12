import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// Import from barrel file
import { 
  SpotifyService, 
  SpotifyArtist, 
  SpotifyPlaylist, 
  SpotifyTrack, 
  GeneratedTrackInfo, 
  SpotifyArtistAlbum, 
  SpotifyAlbumTrack,
  LoggerService
} from '../../services';

import { MixGeneratorLoaderComponent } from '../mix-generator-loader/mix-generator-loader.component';

interface FeedbackMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

// Define types for clarity
export type SourceMode = 'followedOnly' | 'mix' | 'playlistsOnly' | 'customSelection';

@Component({
  selector: 'app-mix-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, MixGeneratorLoaderComponent],
  templateUrl: './mix-generator.component.html',
  styleUrls: ['./mix-generator.component.scss']
})
export class MixGeneratorComponent implements OnInit, OnDestroy {

  // --- State for User Selections ---
  selectedLength: 10 | 30 | 50 = 30; // Default length
  selectedSourceMode: SourceMode = 'mix'; // Default mode
  playlistName: string = ''; // For saving
  isPlaylistPublic: boolean = true; // Option for saving
  customSelectedArtistIds: string[] = []; // Store IDs of artists user picked
  customSelectedPlaylistIds: string[] = []; // Store IDs of playlists user picked

  readonly MAX_CUSTOM_ARTISTS = 10;
  readonly MAX_CUSTOM_PLAYLISTS = 10;

  // --- State for Data & UI ---
  fullFollowedArtists: SpotifyArtist[] = [];
  fullUserPlaylists: SpotifyPlaylist[] = [];
  followedArtists: any[] = []; // Store full artist objects {id, name, ...}
  followedArtistIds: Set<string> = new Set(); 
  generatedTracks: GeneratedTrackInfo[] = []; // The final list shown to the user
  spotifyUserId: string | null = null;
  createdPlaylistUrl: string | null = null; // URL of the saved playlist

  // Loading and Error States
  loadingFollowed: boolean = false;
  loadingPlaylists: boolean = false;
  generatingMix: boolean = false;
  generatingMixStatus: string = '';
  savingPlaylist: boolean = false;
  error: string | null = null;
  generationError: string | null = null; // Specific error during generation
  
  saveSuccess: boolean = false;
  saveError: string | null = null;  
  isLoggedIn: boolean = false;

  customSearchTerm: string = '';
  filteredFollowedArtists: SpotifyArtist[] = [];
  filteredUserPlaylists: SpotifyPlaylist[] = [];  
  
  feedbackMessage: FeedbackMessage | null = null;  
  private feedbackTimeout: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    public spotifyService: SpotifyService,
    private logger: LoggerService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Use the observable for login state instead of direct method call
    this.spotifyService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        if (this.isLoggedIn) {
          this.loadInitialData();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.feedbackTimeout) { 
      clearTimeout(this.feedbackTimeout); 
    }
  }

  // --- Initial Data Loading ---
  loadInitialData(): void {
    this.loadUserProfile(); // Fetch user ID for saving playlists
    this.loadAllFollowedArtists(); // Fetch followed artists proactively
    this.loadAllUserPlaylists(); // Load user playlists   
  }

  async loadUserProfile(): Promise<void> {
    this.error = null;
    try {
      // Use the user profile from the service
      const profile = await this.spotifyService.getUserProfile();
      if (profile && profile.id) {
        this.spotifyUserId = profile.id;
        this.logger.log('User profile loaded, ID:', this.spotifyUserId);
      } else {
        this.error = "Could not load user profile ID.";
      }
    } catch (err: any) {
      this.logger.error("Error loading user profile:", err);
      this.error = "Could not load user profile.";
    }
  }

  // Helper method to check if an artist is selected in custom mode
  isArtistCustomSelected(artistId: string): boolean {
    return this.customSelectedArtistIds.includes(artistId);
  }

  // Helper method to toggle artist selection for custom mode
  toggleCustomArtist(artist: SpotifyArtist): void {
    const index = this.customSelectedArtistIds.indexOf(artist.id);
    if (index > -1) {
      this.customSelectedArtistIds.splice(index, 1);
    } else {
      if (this.customSelectedArtistIds.length < this.MAX_CUSTOM_ARTISTS) {
        this.customSelectedArtistIds.push(artist.id);
      } else {
        this.showFeedback('info', `You can select up to ${this.MAX_CUSTOM_ARTISTS} artists.`);
      }
    }
    this.logger.debug('Custom Selected Artist IDs:', this.customSelectedArtistIds);
  }

  // Helper method to check if a playlist is selected in custom mode
  isPlaylistCustomSelected(playlistId: string): boolean {
    return this.customSelectedPlaylistIds.includes(playlistId);
  }

  // Helper method to toggle playlist selection for custom mode
  toggleCustomPlaylist(playlist: SpotifyPlaylist): void {
    const index = this.customSelectedPlaylistIds.indexOf(playlist.id);
    if (index > -1) {
      this.customSelectedPlaylistIds.splice(index, 1);
    } else {
      if (this.customSelectedPlaylistIds.length < this.MAX_CUSTOM_PLAYLISTS) {
        this.customSelectedPlaylistIds.push(playlist.id);
      } else {
         this.showFeedback('info', `You can select up to ${this.MAX_CUSTOM_PLAYLISTS} playlists.`);
      }
    }
    this.logger.debug('Custom Selected Playlist IDs:', this.customSelectedPlaylistIds);
  }

  private showFeedback(type: FeedbackMessage['type'], text: string, durationMs: number = 4000): void {
    this.logger.log(`Feedback (${type}): ${text}`);
    if (this.feedbackTimeout) { 
      clearTimeout(this.feedbackTimeout); 
    }
    this.feedbackMessage = { type, text };
    this.cdRef.detectChanges();
    this.feedbackTimeout = setTimeout(() => {
      this.feedbackMessage = null;
      this.cdRef.detectChanges();
    }, durationMs);
  }

  // When switching modes, clear custom selections
  setSourceMode(mode: SourceMode): void {
    if (this.selectedSourceMode !== 'customSelection' && mode === 'customSelection') {
      // Entering custom mode, selections might be stale or need user interaction
      // this.customSelectedArtistIds = []; // Optionally clear when entering mode
      // this.customSelectedPlaylistIds = [];
    } else if (this.selectedSourceMode === 'customSelection' && mode !== 'customSelection') {
      // Leaving custom mode, definitely clear selections
      this.customSelectedArtistIds = [];
      this.customSelectedPlaylistIds = [];
    }
    this.selectedSourceMode = mode;
    this.logger.log('Source mode set to:', this.selectedSourceMode);
    // Adjust available track lengths for custom selection mode
    if (mode === 'customSelection' && this.selectedLength === 50) {
      this.selectedLength = 30; // Default to 30 if 50 was selected
    }
  }
  
  async loadAllFollowedArtists(): Promise<void> {
    this.loadingFollowed = true;
    this.error = null;
    this.fullFollowedArtists = [];
    this.followedArtistIds.clear();
    
    try {
      this.fullFollowedArtists = await this.spotifyService.getAllFollowedArtists();
      this.filteredFollowedArtists = [...this.fullFollowedArtists];
      this.logger.log(`Loaded ${this.fullFollowedArtists.length} total followed artists.`);
    } catch (err: any) {
      this.handleError(err, "Could not load followed artists.");
    } finally {
      this.loadingFollowed = false;
      this.cdRef.detectChanges();
    }
  }
  
  async loadAllUserPlaylists(): Promise<void> {
    this.loadingPlaylists = true;
    this.error = null;
    this.fullUserPlaylists = [];
    
    try {
      const playlists = await this.spotifyService.getAllUserPlaylists();
      this.fullUserPlaylists = playlists.filter(p => p.tracks?.total > 0 && p.owner); // Ensure owner exists
      this.filteredUserPlaylists = [...this.fullUserPlaylists]; 
      this.logger.log(`Loaded ${this.fullUserPlaylists.length} total non-empty user playlists.`);
    } catch (err: any) {
      this.handleError(err, "Could not load user playlists.");
    } finally {
      this.loadingPlaylists = false;
      this.cdRef.detectChanges();
    }
  }

  // --- Helper Methods ---
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fisher-Yates shuffle algorithm
  shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
  }
  
  getArtistNames(artists: any[]): string {
    if (!artists || artists.length === 0) {
      return 'Unknown Artist';
    }
    return artists.map(a => a.name).join(', ');
  }

  login(): void {
    this.spotifyService.authorize('/mix-generator'); 
  }

  handleImageError(event: Event): void {
    this.logger.warn('Image failed to load, using fallback.');
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/no-image.jpg'; // Make sure this path is correct!
  }

  private handleError(err: any, defaultMessage: string): void {
    this.logger.error(`Error: ${defaultMessage}`, err);
    const message = err?.message || defaultMessage;
    this.showFeedback('error', message, 7000);  
  }

  clearActionFeedback(): void { 
    if (this.feedbackTimeout) { 
      clearTimeout(this.feedbackTimeout); 
    }
    this.feedbackMessage = null;
  }
  
  async generateMix(): Promise<void> {
    if (!this.isLoggedIn || this.generatingMix) return;

    // --- Reset State ---
    this.generatingMix = true;
    this.generatingMixStatus = 'Initializing...';
    this.error = null;
    this.generationError = null;
    this.generatedTracks = [];
    this.createdPlaylistUrl = null;
    this.saveSuccess = false;
    this.saveError = null;
    this.cdRef.detectChanges();

    // --- Data Structures & Constants ---
    const rawTrackList: GeneratedTrackInfo[] = [];
    const fetchedTrackIds = new Set<string>(); 
    const TARGET_ALBUM_TRACKS = Math.ceil(this.selectedLength * 0.5); 
    const TARGET_TOP_TRACKS = this.selectedLength - TARGET_ALBUM_TRACKS; 
    const ARTIST_SAMPLE_COUNT_ALBUMS = Math.max(15, TARGET_ALBUM_TRACKS * 3); // Sample more for album diversity
    const ARTIST_SAMPLE_COUNT_TOP = Math.max(15, this.selectedLength * 2);    // Sample for top tracks
    const ALBUMS_PER_ARTIST = 1;    
    const TRACKS_PER_ALBUM = 2;     
    const PLAYLIST_SAMPLE_COUNT = Math.min(12, Math.max(8, this.selectedLength / 2)); 
    const PLAYLIST_SAMPLE_SIZE = 10;
    const TARGET_CUSTOM_ARTIST_TRACKS = Math.ceil(this.selectedLength * 0.5); 
    const TARGET_CUSTOM_PLAYLIST_TRACKS = this.selectedLength - TARGET_CUSTOM_ARTIST_TRACKS;

    try {
      // --- Ensure Base Data Loaded ---
      this.generatingMixStatus = 'Checking library data...';
      this.cdRef.detectChanges();

      // --- STEP 1: Fetch Tracks Based on selectedSourceMode ---

      // --- A: Followed Artists Only ---
      if (this.selectedSourceMode === 'followedOnly') {
        if (this.fullFollowedArtists.length === 0) {
          await this.loadAllFollowedArtists();
        }
        if (this.fullFollowedArtists.length === 0) {
          throw new Error("No followed artists loaded for 'Followed Only' mode.");
        }
        
        this.generatingMixStatus = 'Fetching tracks from followed artists...';
        this.cdRef.detectChanges();
        
        // --- Separate Pools for this mode ---
        const albumTrackPool: GeneratedTrackInfo[] = []; 
        const topTrackPool: GeneratedTrackInfo[] = [];   

        // --- Fetch Album Tracks ---
        this.logger.log(`Sampling ${ARTIST_SAMPLE_COUNT_ALBUMS} artists for album tracks.`);
        let artistsToSampleAlbums = this.shuffleArray([...this.fullFollowedArtists]).slice(0, ARTIST_SAMPLE_COUNT_ALBUMS);
        let artistAlbumTrackCount = 0;
        
        for (const artist of artistsToSampleAlbums) {
          await this.delay(200); 
          try {
            const albums = await this.spotifyService.getAllArtistAlbums(artist.id);
            if (albums.length > 0) {
              const albumsToSampleFrom = this.shuffleArray(albums).slice(0, ALBUMS_PER_ARTIST); 
              for (const album of albumsToSampleFrom) {
                await this.delay(200);
                const tracks = await this.spotifyService.getAllAlbumTracks(album.id);
                const tracksToAdd = this.shuffleArray(tracks).slice(0, TRACKS_PER_ALBUM); 
                tracksToAdd.forEach((track: SpotifyAlbumTrack) => {
                  if (track?.id && !fetchedTrackIds.has(track.id)) {
                    fetchedTrackIds.add(track.id);
                    albumTrackPool.push({ 
                      track: this.mapAlbumTrackToFullTrack(track, album), // Use mapping
                      sourceType: 'followedArtistAlbum', 
                      sourceName: artist.name, 
                      sourceAlbumName: album.name 
                    });
                    artistAlbumTrackCount++;
                  }
                });
              } 
            }
          } catch (err) {
            this.logger.warn(`Could not process album tracks for artist ${artist.id}`, err);
          }
        } 
        this.logger.log(`Collected ${artistAlbumTrackCount} potential album tracks.`);

        // --- Fetch Top Tracks ---
        this.logger.log(`Sampling ${ARTIST_SAMPLE_COUNT_TOP} artists for top tracks.`);
        let artistsToSampleTop = this.shuffleArray([...this.fullFollowedArtists]).slice(0, ARTIST_SAMPLE_COUNT_TOP);
        let artistTopTrackCount = 0;
        
        for (const artist of artistsToSampleTop) {
          await this.delay(150);
          try {
            const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
            if (topTracksData && topTracksData.length > 0) {
              topTracksData.forEach((track: SpotifyTrack) => {
                if (track?.id && !fetchedTrackIds.has(track.id)) {
                  fetchedTrackIds.add(track.id);
                  topTrackPool.push({ 
                    track: track, 
                    sourceType: 'followedArtistTopTrack', 
                    sourceName: artist.name 
                  });
                  artistTopTrackCount++;
                }
              });
            }
          } catch (err) {
            this.logger.warn(`Could not get top tracks for artist ${artist.id}`, err);
          }
        }
        this.logger.log(`Collected ${artistTopTrackCount} potential top tracks.`);             
        // Combine pools for processing AFTER fetching separately for this mode
        rawTrackList.push(...albumTrackPool, ...topTrackPool);
      } // --- End Followed Artists Only Logic ---

      // --- B: Playlists Only ---
      else if (this.selectedSourceMode === 'playlistsOnly') {
        if (this.fullUserPlaylists.length === 0) {
          await this.loadAllUserPlaylists();
        }
        if (this.fullUserPlaylists.length === 0) {
          throw new Error("No playlists loaded for 'Playlists Only' mode.");
        }

        this.generatingMixStatus = 'Fetching tracks from your playlists...';
        this.cdRef.detectChanges();
        
        const playlistsToSample = this.shuffleArray([...this.fullUserPlaylists]).slice(0, PLAYLIST_SAMPLE_COUNT);
        this.logger.log(`Selected ${playlistsToSample.length} playlists to sample.`);
        
        let playlistFetchedCount = 0;
        for (const playlist of playlistsToSample) {
          if (!playlist?.id) continue;
          
          await this.delay(150);
          try {
            const tracksInPlaylist = await this.spotifyService.getAllPlaylistTracks(playlist.id);
            const sampledTracks = this.shuffleArray(tracksInPlaylist).slice(0, PLAYLIST_SAMPLE_SIZE);
            
            sampledTracks.forEach((track: SpotifyTrack) => {
              if (track?.id && !fetchedTrackIds.has(track.id)) {
                fetchedTrackIds.add(track.id);
                rawTrackList.push({ 
                  track: track, 
                  sourceType: 'playlist', 
                  sourceName: playlist.name 
                });
                playlistFetchedCount++;
              }
            });
          } catch (listErr) {
            this.logger.warn(`Could not fetch tracks for playlist ${playlist.name || playlist.id}`, listErr);
          }
        }
        this.logger.log(`Collected ${playlistFetchedCount} unique tracks from ${playlistsToSample.length} playlists.`);
      } // --- End Playlist Logic ---

      // --- C: Mix (Followed Artists + Playlists) ---
      else if (this.selectedSourceMode === 'mix') {
        let playlistFetchedCount = 0;
        let artistTopTrackCount = 0;

        // --- Fetch Playlist Tracks ---
        if (this.fullUserPlaylists.length === 0) {
          await this.loadAllUserPlaylists();
        }
        
        if (this.fullUserPlaylists.length === 0) {
          this.logger.warn("No playlists loaded for 'Mix' mode playlist part.");
        } else {
          this.generatingMixStatus = 'Fetching tracks from playlists...';
          this.cdRef.detectChanges();
          
          const playlistsToSample = this.shuffleArray([...this.fullUserPlaylists]).slice(0, PLAYLIST_SAMPLE_COUNT);
          this.logger.log(`Selected ${playlistsToSample.length} playlists to sample for 'Mix'.`);
          
          for (const playlist of playlistsToSample) { 
            if (!playlist?.id) continue;
            
            await this.delay(150);
            try {
              const tracksInPlaylist = await this.spotifyService.getAllPlaylistTracks(playlist.id);
              const sampledTracks = this.shuffleArray(tracksInPlaylist).slice(0, PLAYLIST_SAMPLE_SIZE);
              
              sampledTracks.forEach((track: SpotifyTrack) => {
                if (track?.id && !fetchedTrackIds.has(track.id)) {
                  fetchedTrackIds.add(track.id);
                  rawTrackList.push({ 
                    track: track, 
                    sourceType: 'playlist', 
                    sourceName: playlist.name 
                  });
                  playlistFetchedCount++;
                }
              });
            } catch(listErr) {
              this.logger.warn(`Could not fetch tracks for playlist ${playlist.name || playlist.id}`, listErr);
            }
          }
          this.logger.log(`Collected ${playlistFetchedCount} unique tracks from playlists for 'Mix'.`);                
        } // End playlist fetch for Mix

        // --- Fetch Followed Artist Top Tracks ---
        if (this.fullFollowedArtists.length === 0) {
          await this.loadAllFollowedArtists();
        }
        
        if (this.fullFollowedArtists.length === 0) {
          this.logger.warn("No followed artists loaded for 'Mix' mode artist part.");
        } else {
          this.generatingMixStatus = 'Fetching tracks from followed artists...';
          this.cdRef.detectChanges();
          
          const artistsToSample = this.shuffleArray([...this.fullFollowedArtists]).slice(0, ARTIST_SAMPLE_COUNT_TOP); 
          this.logger.log(`Selected ${artistsToSample.length} followed artists for top track sampling for 'Mix'.`);
          
          for (const artist of artistsToSample) {
            await this.delay(150);
            try {
              const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
              if (topTracksData && topTracksData.length > 0) {
                topTracksData.forEach((track: SpotifyTrack) => {
                  if (track?.id && !fetchedTrackIds.has(track.id)) {
                    fetchedTrackIds.add(track.id);
                    rawTrackList.push({ 
                      track: track, 
                      sourceType: 'followedArtistTopTrack', 
                      sourceName: artist.name 
                    });
                    artistTopTrackCount++;
                  }
                });
              }
            } catch (err) {
              this.logger.warn(`Could not get top tracks for followed artist ${artist.id} during mix`, err);
            }
          }
          this.logger.log(`Collected ${artistTopTrackCount} unique top tracks from followed artists for 'Mix'.`);
        } // End artist fetch for Mix
      } 
      // --- MODE D: Custom Selection ---
      else if (this.selectedSourceMode === 'customSelection'){
        this.generatingMixStatus = 'Fetching tracks from custom selections...';
        this.cdRef.detectChanges();
        
        if (this.customSelectedArtistIds.length === 0 && this.customSelectedPlaylistIds.length === 0) {
          throw new Error("Please select at least one artist or playlist for custom selection mode.");
        }

        const customArtistTrackPool: GeneratedTrackInfo[] = [];
        const customPlaylistTrackPool: GeneratedTrackInfo[] = [];

        // --- Fetch from Selected Followed Artists (Albums + Top Tracks) ---
        if (this.customSelectedArtistIds.length > 0) {
          this.logger.log(`Fetching for ${this.customSelectedArtistIds.length} custom selected artists.`);
          
          for (const artistId of this.customSelectedArtistIds) {
            const artist = this.fullFollowedArtists.find(a => a.id === artistId);
            if (!artist) continue; 
            
            this.generatingMixStatus = `Fetching from artist: ${artist.name}...`;
            this.cdRef.detectChanges();
            
            // Fetch from Albums/Singles
            await this.delay(200);
            try {
              const albums = await this.spotifyService.getAllArtistAlbums(artist.id);
              if (albums.length > 0) {
                const albumToSample = this.shuffleArray(albums)[0]; 
                await this.delay(200);
                
                const tracks = await this.spotifyService.getAllAlbumTracks(albumToSample.id);
                const tracksToAddFromAlbum = this.shuffleArray(tracks).slice(0, TRACKS_PER_ALBUM);
                
                tracksToAddFromAlbum.forEach((track: SpotifyAlbumTrack) => {
                  if (track?.id && !fetchedTrackIds.has(track.id)) {
                    fetchedTrackIds.add(track.id);
                    customArtistTrackPool.push({ 
                      track: this.mapAlbumTrackToFullTrack(track, albumToSample), 
                      sourceType: 'followedArtistAlbum', 
                      sourceName: artist.name, 
                      sourceAlbumName: albumToSample.name 
                    });
                  }
                });
              }
            } catch (err) {
              this.logger.warn(`Error fetching albums for artist ${artist.id}:`, err);
            }
            
            // Fetch from Top Tracks
            await this.delay(150);
            try {
              const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
              if (topTracksData && topTracksData.length > 0) {
                topTracksData.forEach((track: SpotifyTrack) => {
                  if (track?.id && !fetchedTrackIds.has(track.id)) {
                    fetchedTrackIds.add(track.id);
                    customArtistTrackPool.push({ 
                      track: track, 
                      sourceType: 'followedArtistTopTrack', 
                      sourceName: artist.name 
                    });
                  }
                });
              }
            } catch (err) {
              this.logger.warn(`Error fetching top tracks for artist ${artist.id}:`, err);
            }
          } 
          this.logger.log(`Collected ${customArtistTrackPool.length} potential tracks from custom artists.`);
        } 

        // --- Fetch from Selected Playlists ---
        if (this.customSelectedPlaylistIds.length > 0) {
          this.logger.log(`Fetching for ${this.customSelectedPlaylistIds.length} custom selected playlists.`);
          
          for (const playlistId of this.customSelectedPlaylistIds) {
            const playlist = this.fullUserPlaylists.find(p => p.id === playlistId);
            if (!playlist) continue;
            
            this.generatingMixStatus = `Fetching from playlist: ${playlist.name}...`;
            this.cdRef.detectChanges();
            
            await this.delay(150);
            try {
              const tracksInPlaylist = await this.spotifyService.getAllPlaylistTracks(playlist.id);
              // Add ALL unique tracks from these selected playlists
              tracksInPlaylist.forEach((track: SpotifyTrack) => {
                if (track?.id && !fetchedTrackIds.has(track.id)) {
                  fetchedTrackIds.add(track.id);
                  customPlaylistTrackPool.push({ 
                    track: track, 
                    sourceType: 'playlist', 
                    sourceName: playlist.name 
                  });
                }
              });
            } catch (listErr) {
              this.logger.warn(`Error fetching tracks for playlist ${playlist.id}:`, listErr);
            }
          }
          this.logger.log(`Collected ${customPlaylistTrackPool.length} potential tracks from custom playlists.`);
        }           
        rawTrackList.push(...customArtistTrackPool, ...customPlaylistTrackPool);
      }
      
      // --- STEP 2: Process Tracks ---
      this.generatingMixStatus = 'Processing tracks...';
      this.cdRef.detectChanges();
      
      this.logger.log(`Total raw unique tracks collected: ${rawTrackList.length}`);
      if (rawTrackList.length === 0) {
        throw new Error("Could not find any source tracks.");
      }

      let processedTracks = Array.from(new Map(rawTrackList.map(item => [item.track.id, item])).values());
      this.logger.log(`Tracks after de-duplication: ${processedTracks.length}`);
      processedTracks = this.shuffleArray(processedTracks);

      // --- Final Selection & Artist Capping/Balancing ---
      let finalTracks: GeneratedTrackInfo[] = [];
      const artistTrackCount: { [artistId: string]: number } = {};
      
      // --- Specific logic for 'customSelection' with artists and playlists ---
      if (this.selectedSourceMode === 'customSelection' && this.customSelectedArtistIds.length > 0 && this.customSelectedPlaylistIds.length > 0) {
        // --- Custom MIX: Artists + Playlists (Aim for 50/50) ---
        this.logger.log(`Balancing custom artists & playlists. Target: ${TARGET_CUSTOM_ARTIST_TRACKS} artist, ${TARGET_CUSTOM_PLAYLIST_TRACKS} playlist.`);
        
        // Separate processed tracks by source for this specific mode
        const availableCustomArtistTracks = this.shuffleArray(processedTracks.filter(item => 
          item.sourceType === 'followedArtistAlbum' || item.sourceType === 'followedArtistTopTrack'
        ));
        
        const availableCustomPlaylistTracks = this.shuffleArray(processedTracks.filter(item => 
          item.sourceType === 'playlist'
        ));
        
        // Apply cap of 2 per artist *within the artist pool* first
        const cappedCustomArtistTracks: GeneratedTrackInfo[] = [];
        for (const item of availableCustomArtistTracks) {
          const primaryArtistId = item.track.artists?.[0]?.id;
          if (primaryArtistId) {
            const currentCount = artistTrackCount[primaryArtistId] || 0;
            if (currentCount < 2) { // Standard cap of 2
              cappedCustomArtistTracks.push(item);
              artistTrackCount[primaryArtistId] = currentCount + 1;
            }
          } else {
            cappedCustomArtistTracks.push(item); // Include tracks with no primary artist
          }
        }
        this.logger.log(`Custom artist tracks after preliminary cap: ${cappedCustomArtistTracks.length}`);

        // Fill final list with priority to artist tracks up to TARGET_CUSTOM_ARTIST_TRACKS
        finalTracks.push(...cappedCustomArtistTracks.slice(0, TARGET_CUSTOM_ARTIST_TRACKS));
        
        // Fill remaining with playlist tracks
        const neededPlaylistTracks = this.selectedLength - finalTracks.length;
        if (neededPlaylistTracks > 0) {
          finalTracks.push(...availableCustomPlaylistTracks.slice(0, neededPlaylistTracks));
        }
        
        // If still short, fill with any remaining artist tracks, then any remaining playlist tracks
        let currentFinalIds = new Set(finalTracks.map(item => item.track.id));
        if (finalTracks.length < this.selectedLength) {
          cappedCustomArtistTracks.slice(finalTracks.filter(ft => ft.sourceType.includes('Artist')).length).forEach(item => {
            if (finalTracks.length < this.selectedLength && !currentFinalIds.has(item.track.id)) {
              finalTracks.push(item);
              currentFinalIds.add(item.track.id);
            }
          });
        }
        
        if (finalTracks.length < this.selectedLength) {
          availableCustomPlaylistTracks.slice(finalTracks.filter(ft => ft.sourceType === 'playlist').length).forEach(item => {
            if (finalTracks.length < this.selectedLength && !currentFinalIds.has(item.track.id)) {
              finalTracks.push(item);
              currentFinalIds.add(item.track.id);
            }
          });
        }
        
        this.generatedTracks = this.shuffleArray(finalTracks).slice(0, this.selectedLength); // Final shuffle & precise slice
      }
      else if (this.selectedSourceMode === 'customSelection' && this.customSelectedArtistIds.length > 0) {
        // --- Custom selection with only artists ---
        this.logger.log("Applying balanced artist selection for 'Custom Artists Only' mode.");
        const idealTracksPerArtist = Math.ceil(this.selectedLength / this.customSelectedArtistIds.length);
        
        // Adjust maxPerArtist dynamically, ensuring it's at least 1, and not excessively large if few artists selected.
        const maxPerArtistInitial = Math.max(1, idealTracksPerArtist); 
        this.logger.log(`Targeting ~${idealTracksPerArtist} tracks per selected artist (initial max: ${maxPerArtistInitial}).`);

        // Create a map of tracks by artist ID from the processed (deduplicated, shuffled) list
        const tracksByArtist: { [artistId: string]: GeneratedTrackInfo[] } = {};
        for (const item of processedTracks) {
          const primaryArtistId = item.track.artists?.[0]?.id;
          if (primaryArtistId && this.customSelectedArtistIds.includes(primaryArtistId)) {
            // Only consider selected artists
            if (!tracksByArtist[primaryArtistId]) {
              tracksByArtist[primaryArtistId] = [];
            }
            tracksByArtist[primaryArtistId].push(item);
          }
        }
        
        // First pass: try to get up to 'maxPerArtistInitial' from each selected artist
        for (const artistId of this.customSelectedArtistIds) {
          const artistTracks = this.shuffleArray(tracksByArtist[artistId] || []); // Shuffle this artist's tracks
          let countForThisArtist = 0;
          for (const trackItem of artistTracks) {
            if (finalTracks.length < this.selectedLength && countForThisArtist < maxPerArtistInitial) {
              if (!finalTracks.some(ft => ft.track.id === trackItem.track.id)) { // Ensure uniqueness in final list
                finalTracks.push(trackItem);
                artistTrackCount[artistId] = (artistTrackCount[artistId] || 0) + 1;
                countForThisArtist++;
              }
            } else {
              break; // Reached max for this artist or total length
            }
          }
        }
        
        this.logger.log(`Tracks after initial balanced pass: ${finalTracks.length}`);
        
        // Second pass: If still short, fill remaining slots from the pool of processed tracks
        const fillCapPerArtist = maxPerArtistInitial + 2; // Allow a bit more from artists with more tracks
        if (finalTracks.length < this.selectedLength) {
          this.logger.log("Playlist still short, filling remaining slots...");
          for (const item of processedTracks) {
            if (finalTracks.length >= this.selectedLength) break;
            
            if (!finalTracks.some(ft => ft.track.id === item.track.id)) { // If not already added
              const primaryArtistId = item.track.artists?.[0]?.id;
              if (primaryArtistId && this.customSelectedArtistIds.includes(primaryArtistId)) {
                if ((artistTrackCount[primaryArtistId] || 0) < fillCapPerArtist) {
                  finalTracks.push(item);
                  artistTrackCount[primaryArtistId] = (artistTrackCount[primaryArtistId] || 0) + 1;
                }
              } else if (!primaryArtistId) { 
                // Just in case there are tracks without artist ID
                finalTracks.push(item);
              }
            }
          }
        }
        
        this.generatedTracks = this.shuffleArray(finalTracks).slice(0, this.selectedLength); // Final shuffle & slice
      }
      // --- Logic for 'followedOnly' mode (album tracks + top tracks balance) ---
      else if (this.selectedSourceMode === 'followedOnly') {
        this.logger.log(`Applying standard artist cap (max 2) and balancing for 'followedOnly'. Target: ${TARGET_ALBUM_TRACKS} album, ${TARGET_TOP_TRACKS} top.`);
        
        // Apply the standard "max 2 per artist" cap first
        for (const item of processedTracks) { 
          const primaryArtistId = item.track.artists?.[0]?.id;
          if (primaryArtistId) {
            const currentCount = artistTrackCount[primaryArtistId] || 0;
            if (currentCount < 2) {
              finalTracks.push(item);
              artistTrackCount[primaryArtistId] = currentCount + 1;
            }
          } else {
            finalTracks.push(item); 
          }
        }
        
        processedTracks = this.shuffleArray(finalTracks); // Shuffle the capped list
        finalTracks = []; // Reset for final selection

        // Now do the 50/50 balancing from the capped list
        const cappedAlbumTracks = processedTracks.filter(t => t.sourceType === 'followedArtistAlbum');
        const cappedTopTracks = processedTracks.filter(t => t.sourceType === 'followedArtistTopTrack');
        
        finalTracks.push(...cappedAlbumTracks.slice(0, TARGET_ALBUM_TRACKS)); 
        
        const neededTop = this.selectedLength - finalTracks.length;
        if (neededTop > 0) {
          finalTracks.push(...cappedTopTracks.slice(0, neededTop)); 
        }
        
        // If we still don't have enough tracks, add any remaining tracks from either source
        const neededMore = this.selectedLength - finalTracks.length;
        if (neededMore > 0) {
          const currentIds = new Set(finalTracks.map(item => item.track.id));
          const remainingTracks = processedTracks.filter(t => !currentIds.has(t.track.id));
          finalTracks.push(...remainingTracks.slice(0, neededMore));
        }
        
        this.generatedTracks = finalTracks.slice(0, this.selectedLength);
      } 
      // --- Logic for 'mix' and 'playlistsOnly' (simple cap and slice) ---
      else { 
        this.logger.log(`Applying standard artist cap (max 2 per artist) for mode: ${this.selectedSourceMode}`);
        
        for (const item of processedTracks) { 
          const primaryArtistId = item.track.artists?.[0]?.id;
          if (primaryArtistId) {
            const currentCount = artistTrackCount[primaryArtistId] || 0;
            if (currentCount < 2) {
              finalTracks.push(item);
              artistTrackCount[primaryArtistId] = currentCount + 1;
            }
          } else {
            finalTracks.push(item); 
          }
        }
        
        this.generatedTracks = this.shuffleArray(finalTracks).slice(0, this.selectedLength);
      }
      
      this.logger.log(`Final track list length: ${this.generatedTracks.length}.`);
      
      // Log source breakdown for followedOnly mode
      if (this.selectedSourceMode === 'followedOnly') {
        this.logger.log(
          `Mode: followedOnly - Contains ${this.generatedTracks.filter(t => t.sourceType === 'followedArtistAlbum').length} album tracks and ` +
          `${this.generatedTracks.filter(t => t.sourceType === 'followedArtistTopTrack').length} top tracks.`
        );
      }
      
      if (this.generatedTracks.length === 0) {
        this.generationError = "No tracks matched criteria after processing.";
      }
    } catch (err: any) {
      this.handleError(err, 'An error occurred while generating the mix.');
      this.generationError = this.feedbackMessage?.text || 'Generation failed.'; 
      this.feedbackMessage = null; 
    } finally {
      this.generatingMix = false;
      this.generatingMixStatus = ''; 
      this.cdRef.detectChanges();
    }
  }

  /**
   * Filter custom selections based on search term
   */
  filterCustomSelections(): void {
    const searchTerm = this.customSearchTerm.toLowerCase().trim();
    
    // If search term is empty, show all
    if (!searchTerm) {
      this.filteredFollowedArtists = this.fullFollowedArtists;
      this.filteredUserPlaylists = this.fullUserPlaylists;
      return;
    }
    
    // Filter artists by name match
    this.filteredFollowedArtists = this.fullFollowedArtists.filter(artist => 
      artist.name.toLowerCase().includes(searchTerm)
    );
    
    // Filter playlists by name match
    this.filteredUserPlaylists = this.fullUserPlaylists.filter(playlist => 
      playlist.name.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Clears the search term and resets the filtered lists
   */
  clearCustomSearch(): void {
    this.customSearchTerm = '';
    this.filteredFollowedArtists = this.fullFollowedArtists;
    this.filteredUserPlaylists = this.fullUserPlaylists;
  }

  /**
   * Initialize the filtered lists whenever the source data changes
   */
  initializeFilteredLists(): void {
    this.filteredFollowedArtists = this.fullFollowedArtists;
    this.filteredUserPlaylists = this.fullUserPlaylists;
  }

  /**
   * Maps a Spotify album track to a full track object
   * This is needed because album tracks don't have all the properties of a full track
   */
  private mapAlbumTrackToFullTrack(albumTrack: SpotifyAlbumTrack, sourceAlbum: SpotifyArtistAlbum): SpotifyTrack {
    if (!albumTrack) {
      this.logger.error("mapAlbumTrackToFullTrack called with null/undefined albumTrack");
      return {} as SpotifyTrack;
    }
    
    return {
      // --- Properties directly from SpotifyAlbumTrack ---
      id: albumTrack.id,
      name: albumTrack.name,
      uri: albumTrack.uri,
      artists: albumTrack.artists,
      duration_ms: albumTrack.duration_ms,
      explicit: albumTrack.explicit,
      is_local: albumTrack.is_local ?? false,
      preview_url: albumTrack.preview_url,
      
      // --- Properties derived from sourceAlbum ---
      album: {
        id: sourceAlbum.id,
        name: sourceAlbum.name,
        uri: sourceAlbum.uri,
        release_date: sourceAlbum.release_date,
        images: sourceAlbum.images,
        artists: sourceAlbum.artists,
        album_type: sourceAlbum.album_type
      },
      external_urls: { 
        spotify: `https://open.spotify.com/track/${albumTrack.id}`
      },
    };
  }

  /**
   * Remove a track from the generated list
   */
  removeTrack(index: number): void {
    if (index >= 0 && index < this.generatedTracks.length) {
      this.generatedTracks.splice(index, 1);
      this.logger.log(`Removed track at index ${index}. New count: ${this.generatedTracks.length}`);
    }
  }

  /**
   * Save the generated tracks as a new playlist
   */
  async savePlaylist(): Promise<void> {
    // --- 1. Pre-checks ---
    if (this.savingPlaylist) {
      this.logger.warn("Save already in progress.");
      return;
    }
    
    if (!this.spotifyUserId) {
      this.saveError = "Cannot save playlist: User ID not loaded. Please wait or try reloading.";
      this.logger.error(this.saveError);
      return;
    }
    
    if (this.generatedTracks.length === 0) {
      this.saveError = "Cannot save playlist: No tracks generated.";
      this.logger.error(this.saveError);
      return;
    }
    
    const trimmedPlaylistName = this.playlistName.trim();
    if (!trimmedPlaylistName) {
      this.saveError = "Please enter a name for the playlist.";
      return;
    }

    // --- 2. Set Loading State ---
    this.savingPlaylist = true;
    this.saveSuccess = false;
    this.saveError = null;
    this.createdPlaylistUrl = null;
    this.cdRef.detectChanges();

    try {
      // --- 3. Create Playlist ---
      const name = trimmedPlaylistName;
      const description = `Generated mix using (${this.selectedSourceMode} mode): ${this.generatedTracks.length} tracks. Created by MeloVerse`;
      const isPublic = this.isPlaylistPublic;

      this.logger.log(`Creating playlist with name "${name}"`);
      
      // Create the playlist using the facade service
      const createdPlaylist = await this.spotifyService.createPlaylist(
        name, 
        description, 
        isPublic
      );

      if (!createdPlaylist || !createdPlaylist.id) {
        throw new Error("Failed to create playlist (API response invalid).");
      }
      
      const playlistId = createdPlaylist.id;
      this.logger.log(`Playlist created successfully with ID: ${playlistId}`);

      // --- 4. Add Tracks ---
      const trackUris = this.generatedTracks.map(item => item.track.uri).filter(uri => !!uri); 
      
      if (trackUris.length > 0) {
        this.logger.log(`Adding ${trackUris.length} tracks to playlist ${playlistId}`);
        await this.spotifyService.addTracksToPlaylist(playlistId, trackUris);
        this.logger.log(`Tracks added successfully`);
      } else {
        this.logger.warn("No valid track URIs found in the generated list");
      }
      
      // --- 5. Success State ---
      this.saveSuccess = true;
      this.createdPlaylistUrl = createdPlaylist.external_urls?.spotify || null;
      this.playlistName = ''; // Clear input field
      this.logger.log(`Playlist saved! URL: ${this.createdPlaylistUrl}`);
    } catch (err: any) {
      this.logger.error('Error saving playlist:', err);
      this.saveError = err.message || "An error occurred while saving the playlist.";
    } finally {
      this.savingPlaylist = false;
      this.cdRef.detectChanges();
    }
  }
}