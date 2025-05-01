import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Needed for playlist name input ngModel
import { SpotifyService, SpotifyArtist, SpotifyPlaylist, SpotifyTrack, GeneratedTrackInfo } from '../../services/spotify.service'; // Main service


// Define types for clarity
type SourceMode = 'followedOnly' | 'mix' | 'playlistsOnly';

@Component({
  selector: 'app-mix-generator',
  standalone: true,
  imports: [CommonModule, FormsModule], // FormsModule needed for playlist name input
  templateUrl: './mix-generator.component.html',
  styleUrls: ['./mix-generator.component.scss']
})
export class MixGeneratorComponent implements OnInit {

  // --- State for User Selections ---
  selectedLength: 10 | 30 | 50 = 30;// Default length
  selectedSourceMode: SourceMode = 'mix'; // Default mode
  playlistName: string = ''; // For saving
  isPlaylistPublic: boolean = true; // Option for saving

  // --- State for Data & UI ---
  followedArtists: any[] = []; // Store full artist objects {id, name, ...}
  followedArtistIds: Set<string> = new Set(); // Store just IDs for quick lookups
  userPlaylists: SpotifyPlaylist[] = []; // Store playlist objects {id, name, tracks: {total: number}}
  generatedTracks: GeneratedTrackInfo[] = []; // The final list shown to the user
  spotifyUserId: string | null = null;
  createdPlaylistUrl: string | null = null; // URL of the saved playlist

  // Loading and Error States
  loadingFollowed: boolean = false;
  loadingPlaylists: boolean = false; // Added
  generatingMix: boolean = false;
  savingPlaylist: boolean = false;
  error: string | null = null;
  saveSuccess: boolean = false;
  saveError: string | null = null;  
  isLoggedIn: boolean = false;

  constructor(
    public spotifyService: SpotifyService,
    private cdRef: ChangeDetectorRef // Inject ChangeDetectorRef if needed for updates
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.spotifyService.isLoggedIn();
    if (this.isLoggedIn) {
      this.loadInitialData();
    }
  }

  // --- Initial Data Loading ---
  loadInitialData(): void {
    this.loadUserProfile(); // Fetch user ID for saving playlists
    this.loadFollowedArtists(); // Fetch followed artists proactively
    this.loadUserPlaylists(); // Load user playlists   
  }

  async loadUserProfile(): Promise<void> {
    this.error = null;
    try {
      // Assuming getUserProfile is added to SpotifyService
      // async getUserProfile(): Promise<any> { ... calls /me ... }
       const profile = await this.spotifyService.getUserProfile();
       if (profile && profile.id) {
          this.spotifyUserId = profile.id;
          console.log('User profile loaded, ID:', this.spotifyUserId);
       } else {
          this.error = "Could not load user profile ID.";
       }
    } catch (err: any) {
       console.error("Error loading user profile:", err);
       this.error = "Could not load user profile.";
    }
  }

  async loadFollowedArtists(): Promise<void> {
    this.loadingFollowed = true;
    this.error = null; 
    this.followedArtists = [];
    this.followedArtistIds.clear();

    try {
      const fetchedData = await this.spotifyService.getAllFollowedArtists();
      this.followedArtists = fetchedData || [];
      this.followedArtists.forEach(artist => this.followedArtistIds.add(artist.id));
      console.log(`Loaded ${this.followedArtists.length} followed artists`);      
    } catch (err: any) {
       console.error("Error loading followed artists:", err);
       this.error = "Could not load followed artists. Permissions granted?";
    } finally {
      this.loadingFollowed = false; this.cdRef.detectChanges();
    }
  }
  
  async loadUserPlaylists(): Promise<void> {
    this.loadingPlaylists = true; this.error = null;
    this.userPlaylists = [];
    try {
        // Service method now returns SpotifyPlaylist[]
        const playlists = await this.spotifyService.getAllUserPlaylists(); 
        this.userPlaylists = playlists.filter(p => p.tracks?.total > 0); 
        console.log(`Loaded ${this.userPlaylists.length} non-empty user playlists.`);
    } catch (err: any) { this.handleError(err, "Could not load user playlists."); } 
    finally { this.loadingPlaylists = false; this.cdRef.detectChanges(); }
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
    console.warn('Image failed to load, using fallback.');
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/no-image.jpg'; // Make sure this path is correct!
  }
  private handleError(err: any, defaultMessage: string): void {
    console.error(`Error in component: ${defaultMessage}`, err);
    this.error = err?.message || defaultMessage; // Show specific API error if possible
  }

  /// --- Mix Generation Logic (Placeholder for New Strategy) ---
  async generateMix(): Promise<void> {
    if (!this.isLoggedIn || this.generatingMix) return;

    this.generatingMix = true;
    this.error = null;
    this.generatedTracks = [];
    this.createdPlaylistUrl = null; this.saveSuccess = false; this.saveError = null;
    this.cdRef.detectChanges();

    console.log(`Starting mix generation. Mode: ${this.selectedSourceMode}`);
    const rawTrackList: GeneratedTrackInfo[] = [];
    const fetchedTrackIds = new Set<string>(); // For de-duplication
    const ARTIST_TRACK_LIMIT = 10; // Max tracks to fetch per artist
    const PLAYLIST_TRACK_LIMIT = 50; // Max tracks to fetch per playlist page
    const PLAYLIST_SAMPLE_SIZE = 10; // Tracks to *try* and sample per playlist
    const PLAYLIST_SAMPLE_COUNT = 8; // Number of playlists to sampl

    try {
      // --- Fetch Tracks based on Mode ---
        if (this.selectedSourceMode === 'followedOnly' || this.selectedSourceMode === 'mix') {
          if (this.followedArtists.length === 0) { throw new Error("No followed artists loaded."); }
          console.log("Fetching tracks from followed artists...");
          // Select random artists from the *loaded* list (pagination needed later for full list)
          const artistsToSample = this.shuffleArray([...this.followedArtists])
                                   .slice(0, Math.max(15, this.selectedLength)); // Sample enough artists
          let artistFetchedCount = 0;
          for(const artist of artistsToSample) {
              await this.delay(150); // Rate limit
              try {
                  const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
                  topTracksData?.tracks?.slice(0, ARTIST_TRACK_LIMIT).forEach((track: SpotifyTrack) => { // Limit tracks per artist
                      if (track?.id && !fetchedTrackIds.has(track.id)) {
                          fetchedTrackIds.add(track.id);
                          rawTrackList.push({ 
                            track: track, 
                            sourceType: 'followedArtist', 
                            sourceName: artist.name
                        });
                          artistFetchedCount++;
                      }
                  });
              } catch (artistErr) { console.warn(`Could not get tracks for artist ${artist.id}`, artistErr); }
          }
          console.log(`Fetched ${artistFetchedCount} unique tracks from ${artistsToSample.length} followed artists.`);
        } 

        if (this.selectedSourceMode === 'playlistsOnly' || this.selectedSourceMode === 'mix') {
          if (this.userPlaylists.length === 0) { throw new Error("No playlists loaded."); }
          console.log("Fetching tracks from user playlists...");
          // Select random playlists from the *loaded* list (pagination needed later)
          const playlistsToSample = this.shuffleArray([...this.userPlaylists]).slice(0, PLAYLIST_SAMPLE_COUNT);
          let playlistFetchedCount = 0;
          for(const playlist of playlistsToSample) {
              if (!playlist?.id) continue;
              await this.delay(150); // Rate limit
              try {
                  const tracksInPlaylist: SpotifyTrack[] = await this.spotifyService.getAllPlaylistTracks(playlist.id);
                  // Simple random sample from the fetched page
                  const sampledTracks = this.shuffleArray(tracksInPlaylist).slice(0, PLAYLIST_SAMPLE_SIZE);
                  
                  sampledTracks.forEach((track: SpotifyTrack) => {
                      if (track?.id && !fetchedTrackIds.has(track.id)) {
                          fetchedTrackIds.add(track.id);
                          rawTrackList.push({
                            track: track,
                            sourceType: 'playlist',
                            sourceName: playlist.name // Store the playlist name
                        });
                          playlistFetchedCount++;
                      }
                  });
                  // TODO: Add "better workaround" logic here later if needed (fetch more pages/offsets)
              } catch(listErr) { console.warn(`Could not fetch tracks for playlist ${playlist.name || playlist.id}`, listErr); }
          }
          console.log(`Fetched ${playlistFetchedCount} unique tracks from ${playlistsToSample.length} playlists.`);
        }

        console.log(`Total raw tracks fetched (before dedup): ${rawTrackList.length}`);
        if (rawTrackList.length === 0) throw new Error("Could not find any source tracks from selected artists/playlists.");

        // --- Process Tracks ---
        let processedTracks: GeneratedTrackInfo[] = [...rawTrackList];
        
        // De-duplicate (already handled by Set, but keep for safety)
        processedTracks = Array.from(new Map(processedTracks.map(item => [item.track.id, item])).values());
        console.log(`Tracks after de-duplication: ${processedTracks.length}`);

        // Apply Artist Cap
        console.log(`Applying artist cap (max 2 per artist)...`);
        const artistTrackCount: { [artistId: string]: number } = {};
        const cappedTracks: GeneratedTrackInfo[] = [];
        processedTracks = this.shuffleArray(processedTracks);
        for (const item of processedTracks) {
            const primaryArtistId = item.track.artists?.[0]?.id;
            if (primaryArtistId) {
                const currentCount = artistTrackCount[primaryArtistId] || 0;
                if (currentCount < 2) { 
                  cappedTracks.push(item); 
                  artistTrackCount[primaryArtistId] = currentCount + 1; }
            } else { 
              console.warn("Track with no primary artist:", item.sourceName); 
            }
        }
        processedTracks = cappedTracks;
        console.log(`Tracks after artist cap: ${processedTracks.length}`);

        // Shuffle again and Slice
        this.generatedTracks = this.shuffleArray(processedTracks).slice(0, this.selectedLength);
        console.log(`Final track list length: ${this.generatedTracks.length}`);
        if (this.generatedTracks.length === 0) { this.error = "No tracks matched criteria after processing."; }
    } catch (err: any) {
        this.handleError(err, 'An error occurred while generating the mix.');
    } finally {
        this.generatingMix = false;
        this.cdRef.detectChanges();
    }
  } // --- End generateMix ---

  // --- Track Removal ---
  removeTrack(index: number): void {
    if (index >= 0 && index < this.generatedTracks.length) {
      this.generatedTracks.splice(index, 1);
      console.log(`Removed track at index ${index}. New count: ${this.generatedTracks.length}`);
    }
  }

  // --- Playlist Saving ---
  async savePlaylist(): Promise<void> {
    // --- 1. Pre-checks ---
    if (this.savingPlaylist) {
        console.warn("Save already in progress.");
        return; // Don't start another save if one is running
    }
    if (!this.spotifyUserId) {
        this.saveError = "Cannot save playlist: User ID not loaded. Please wait or try reloading.";
        console.error(this.saveError);
        return;
    }
    if (this.generatedTracks.length === 0) {
        this.saveError = "Cannot save playlist: No tracks generated.";
        console.error(this.saveError);
        return;
    }
    const trimmedPlaylistName = this.playlistName.trim();
    if (!trimmedPlaylistName) {
        this.saveError = "Please enter a name for the playlist.";
        // Optionally focus the input field here
        return;
    }

    // --- 2. Set Loading State ---
    this.savingPlaylist = true;
    this.saveSuccess = false;
    this.saveError = null;
    this.createdPlaylistUrl = null;
    this.cdRef.detectChanges(); // Update UI immediately

    try {
        // --- 3. Create Playlist ---
        // Ensure variables are correctly scoped and passed
        const userId = this.spotifyUserId; // Assign to local const for clarity
        const name = trimmedPlaylistName;
        const description = `Generated mix (${this.selectedSourceMode} mode): ${this.generatedTracks.length} tracks. Created by Music Explorer.`;
        const isPublic = this.isPlaylistPublic;

        console.log(`Attempting to create playlist for user ${userId} with name "${name}"`);
        
        // *** Explicitly pass all arguments to the service method ***
        const createdPlaylist = await this.spotifyService.createPlaylist(userId, name, description, isPublic);

        if (!createdPlaylist || !createdPlaylist.id) {
           throw new Error("Failed to create playlist object (API response invalid).");
        }
        const playlistId = createdPlaylist.id;
        console.log(`Playlist created successfully with ID: ${playlistId}`);

        // --- 4. Add Tracks ---
        const trackUris = this.generatedTracks.map(item => item.track.uri).filter(uri => !!uri); 
        
        if (trackUris.length > 0) {
           // Batching needed if > 100, but service handles slicing for now
           console.log(`Attempting to add ${trackUris.length} tracks to playlist ${playlistId}`);
           await this.spotifyService.addTracksToPlaylist(playlistId, trackUris);
           console.log(`Tracks added successfully to playlist ${playlistId}`);
        } else {
            console.warn("No valid track URIs found in the generated list to add.");
            // Playlist created but empty - maybe okay? Or consider it an error?
        }
       
        // --- 5. Success State ---
        this.saveSuccess = true;
        this.createdPlaylistUrl = createdPlaylist.external_urls?.spotify || null;
        this.playlistName = ''; // Clear input field
        console.log(`Playlist saved! URL: ${this.createdPlaylistUrl}`);

        // No automatic window.open based on previous feedback

     } catch (err: any) {
        console.error('Error during savePlaylist pipeline:', err);
        this.saveError = err.message || "An error occurred while saving the playlist.";
     } finally {
        this.savingPlaylist = false;
        this.cdRef.detectChanges(); // Update UI after completion/error
     }
  } 
}
