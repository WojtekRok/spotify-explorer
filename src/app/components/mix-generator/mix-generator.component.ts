import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Needed for playlist name input ngModel
import { SpotifyService, SpotifyArtist, SpotifyPlaylist, SpotifyTrack, GeneratedTrackInfo, SpotifyArtistAlbum, SpotifyAlbumTrack } from '../../services/spotify.service';
import { Subject } from 'rxjs';
import { MixGeneratorLoaderComponent } from '../mix-generator-loader/mix-generator-loader.component';

// Define types for clarity
type SourceMode = 'followedOnly' | 'mix' | 'playlistsOnly';

@Component({
  selector: 'app-mix-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, MixGeneratorLoaderComponent],
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
  fullFollowedArtists: SpotifyArtist[] = [];
  fullUserPlaylists: SpotifyPlaylist[] = [];
  followedArtists: any[] = []; // Store full artist objects {id, name, ...}
  followedArtistIds: Set<string> = new Set(); 
  //userPlaylists: SpotifyPlaylist[] = []; 
  generatedTracks: GeneratedTrackInfo[] = []; // The final list shown to the user
  spotifyUserId: string | null = null;
  createdPlaylistUrl: string | null = null; // URL of the saved playlist

  // Loading and Error States
  loadingFollowed: boolean = false;
  loadingPlaylists: boolean = false; // Added
  generatingMix: boolean = false;
  generatingMixStatus: string = '';
  savingPlaylist: boolean = false;
  error: string | null = null;
  generationError: string | null = null; // Specific error during generation
  saveSuccess: boolean = false;
  saveError: string | null = null;  
  isLoggedIn: boolean = false;

  // Feedback Message state (as implemented before)
  feedbackMessage: { type: string, text: string } | null = null;
  private feedbackTimeout: any = null;

  private destroy$ = new Subject<void>(); // Keep if used for other subscriptions

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.feedbackTimeout) { clearTimeout(this.feedbackTimeout); }
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

  // async loadFollowedArtists(): Promise<void> {
  //   this.loadingFollowed = true;
  //   this.error = null; 
  //   this.followedArtists = [];
  //   this.followedArtistIds.clear();
  //   try {
  //     const fetchedData = await this.spotifyService.getAllFollowedArtists();
  //     this.followedArtists = fetchedData || [];
  //     this.followedArtists.forEach(artist => this.followedArtistIds.add(artist.id));
  //     console.log(`Loaded ${this.followedArtists.length} followed artists`);      
  //   } catch (err: any) {
  //      console.error("Error loading followed artists:", err);
  //      this.error = "Could not load followed artists. Permissions granted?";
  //   } finally {
  //     this.loadingFollowed = false; this.cdRef.detectChanges();
  //   }
  // }

  async loadAllFollowedArtists(): Promise<void> {
    this.loadingFollowed = true; this.error = null;
    this.fullFollowedArtists = []; this.followedArtistIds.clear();
    try {
        this.fullFollowedArtists = await this.spotifyService.getAllFollowedArtists();
        this.fullFollowedArtists.forEach(artist => this.followedArtistIds.add(artist.id));
        console.log(`Loaded ${this.fullFollowedArtists.length} total followed artists.`);
    } catch (err: any) { this.handleError(err, "Could not load followed artists."); }
    finally { this.loadingFollowed = false; this.cdRef.detectChanges(); }
  }
  
  // async loadUserPlaylists(): Promise<void> {
  //   this.loadingPlaylists = true; this.error = null;
  //   this.userPlaylists = [];
  //   try {
  //       // Service method now returns SpotifyPlaylist[]
  //       const playlists = await this.spotifyService.getAllUserPlaylists(); 
  //       this.userPlaylists = playlists.filter(p => p.tracks?.total > 0); 
  //       console.log(`Loaded ${this.userPlaylists.length} non-empty user playlists.`);
  //   } catch (err: any) { this.handleError(err, "Could not load user playlists."); } 
  //   finally { this.loadingPlaylists = false; this.cdRef.detectChanges(); }
  // }
  async loadAllUserPlaylists(): Promise<void> {
    this.loadingPlaylists = true; this.error = null;
    this.fullUserPlaylists = [];
    try {
        const playlists = await this.spotifyService.getAllUserPlaylists();
        this.fullUserPlaylists = playlists.filter(p => p.tracks?.total > 0 && p.owner); // Ensure owner exists
        console.log(`Loaded ${this.fullUserPlaylists.length} total non-empty user playlists.`);
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
  // async generateMix(): Promise<void> {
  //   if (!this.isLoggedIn || this.generatingMix) return;

  //   this.generatingMix = true;
  //   this.error = null;
  //   this.generatedTracks = [];
  //   this.createdPlaylistUrl = null; this.saveSuccess = false; this.saveError = null;
  //   this.cdRef.detectChanges();

  //   console.log(`Starting mix generation. Mode: ${this.selectedSourceMode}`);
  //   const rawTrackList: GeneratedTrackInfo[] = [];
  //   const fetchedTrackIds = new Set<string>(); // For de-duplication
  //   const ARTIST_TRACK_LIMIT = 10; // Max tracks to fetch per artist
  //   const PLAYLIST_TRACK_LIMIT = 50; // Max tracks to fetch per playlist page
  //   const PLAYLIST_SAMPLE_SIZE = 10; // Tracks to *try* and sample per playlist
  //   const PLAYLIST_SAMPLE_COUNT = 8; // Number of playlists to sampl

  //   try {
  //     // --- Fetch Tracks based on Mode ---
  //       if (this.selectedSourceMode === 'followedOnly' || this.selectedSourceMode === 'mix') {
  //         if (this.followedArtists.length === 0) { throw new Error("No followed artists loaded."); }
  //         console.log("Fetching tracks from followed artists...");
  //         // Select random artists from the *loaded* list (pagination needed later for full list)
  //         const artistsToSample = this.shuffleArray([...this.followedArtists])
  //                                  .slice(0, Math.max(15, this.selectedLength)); // Sample enough artists
  //         let artistFetchedCount = 0;
  //         for(const artist of artistsToSample) {
  //             await this.delay(150); // Rate limit
  //             try {
  //                 const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
  //                 topTracksData?.tracks?.slice(0, ARTIST_TRACK_LIMIT).forEach((track: SpotifyTrack) => { // Limit tracks per artist
  //                     if (track?.id && !fetchedTrackIds.has(track.id)) {
  //                         fetchedTrackIds.add(track.id);
  //                         rawTrackList.push({ 
  //                           track: track, 
  //                           sourceType: 'followedArtist', 
  //                           sourceName: artist.name
  //                       });
  //                         artistFetchedCount++;
  //                     }
  //                 });
  //             } catch (artistErr) { console.warn(`Could not get tracks for artist ${artist.id}`, artistErr); }
  //         }
  //         console.log(`Fetched ${artistFetchedCount} unique tracks from ${artistsToSample.length} followed artists.`);
  //       } 

  //       if (this.selectedSourceMode === 'playlistsOnly' || this.selectedSourceMode === 'mix') {
  //         if (this.userPlaylists.length === 0) { throw new Error("No playlists loaded."); }
  //         console.log("Fetching tracks from user playlists...");
  //         // Select random playlists from the *loaded* list (pagination needed later)
  //         const playlistsToSample = this.shuffleArray([...this.userPlaylists]).slice(0, PLAYLIST_SAMPLE_COUNT);
  //         let playlistFetchedCount = 0;
  //         for(const playlist of playlistsToSample) {
  //             if (!playlist?.id) continue;
  //             await this.delay(150); // Rate limit
  //             try {
  //                 const tracksInPlaylist: SpotifyTrack[] = await this.spotifyService.getAllPlaylistTracks(playlist.id);
  //                 // Simple random sample from the fetched page
  //                 const sampledTracks = this.shuffleArray(tracksInPlaylist).slice(0, PLAYLIST_SAMPLE_SIZE);
                  
  //                 sampledTracks.forEach((track: SpotifyTrack) => {
  //                     if (track?.id && !fetchedTrackIds.has(track.id)) {
  //                         fetchedTrackIds.add(track.id);
  //                         rawTrackList.push({
  //                           track: track,
  //                           sourceType: 'playlist',
  //                           sourceName: playlist.name // Store the playlist name
  //                       });
  //                         playlistFetchedCount++;
  //                     }
  //                 });
  //                 // TODO: Add "better workaround" logic here later if needed (fetch more pages/offsets)
  //             } catch(listErr) { console.warn(`Could not fetch tracks for playlist ${playlist.name || playlist.id}`, listErr); }
  //         }
  //         console.log(`Fetched ${playlistFetchedCount} unique tracks from ${playlistsToSample.length} playlists.`);
  //       }

  //       console.log(`Total raw tracks fetched (before dedup): ${rawTrackList.length}`);
  //       if (rawTrackList.length === 0) throw new Error("Could not find any source tracks from selected artists/playlists.");

  //       // --- Process Tracks ---
  //       let processedTracks: GeneratedTrackInfo[] = [...rawTrackList];
        
  //       // De-duplicate (already handled by Set, but keep for safety)
  //       processedTracks = Array.from(new Map(processedTracks.map(item => [item.track.id, item])).values());
  //       console.log(`Tracks after de-duplication: ${processedTracks.length}`);

  //       // Apply Artist Cap
  //       console.log(`Applying artist cap (max 2 per artist)...`);
  //       const artistTrackCount: { [artistId: string]: number } = {};
  //       const cappedTracks: GeneratedTrackInfo[] = [];
  //       processedTracks = this.shuffleArray(processedTracks);
  //       for (const item of processedTracks) {
  //           const primaryArtistId = item.track.artists?.[0]?.id;
  //           if (primaryArtistId) {
  //               const currentCount = artistTrackCount[primaryArtistId] || 0;
  //               if (currentCount < 2) { 
  //                 cappedTracks.push(item); 
  //                 artistTrackCount[primaryArtistId] = currentCount + 1; }
  //           } else { 
  //             console.warn("Track with no primary artist:", item.sourceName); 
  //           }
  //       }
  //       processedTracks = cappedTracks;
  //       console.log(`Tracks after artist cap: ${processedTracks.length}`);

  //       // Shuffle again and Slice
  //       this.generatedTracks = this.shuffleArray(processedTracks).slice(0, this.selectedLength);
  //       console.log(`Final track list length: ${this.generatedTracks.length}`);
  //       if (this.generatedTracks.length === 0) { this.error = "No tracks matched criteria after processing."; }
  //   } catch (err: any) {
  //       this.handleError(err, 'An error occurred while generating the mix.');
  //   } finally {
  //       this.generatingMix = false;
  //       this.cdRef.detectChanges();
  //   }
  // } // --- End generateMix ---
  async generateMix(): Promise<void> {
    if (!this.isLoggedIn || this.generatingMix) return;

    // --- Reset State ---
    this.generatingMix = true;
    this.generatingMixStatus = 'Initializing...';
    this.error = null; this.generationError = null; this.generatedTracks = [];
    this.createdPlaylistUrl = null; this.saveSuccess = false; this.saveError = null;
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

    try {
        // --- Ensure Base Data Loaded ---
        this.generatingMixStatus = 'Checking library data...'; this.cdRef.detectChanges();
        // Checks are now inside the relevant mode blocks

        // --- STEP 1: Fetch Tracks Based on selectedSourceMode ---

        // --- A: Followed Artists Only ---
        if (this.selectedSourceMode === 'followedOnly') {
            if (this.fullFollowedArtists.length === 0) { await this.loadAllFollowedArtists(); }
            if (this.fullFollowedArtists.length === 0) { throw new Error("No followed artists loaded for 'Followed Only' mode."); }
            
            this.generatingMixStatus = 'Fetching tracks from followed artists...'; this.cdRef.detectChanges();
            
            // --- Separate Pools for this mode ---
            const albumTrackPool: GeneratedTrackInfo[] = []; 
            const topTrackPool: GeneratedTrackInfo[] = [];   

            // --- Fetch Album Tracks ---
            console.log(`Sampling ${ARTIST_SAMPLE_COUNT_ALBUMS} artists for album tracks.`);
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
                } catch (err) { console.warn(`Could not process album tracks for artist ${artist.id}`, err); }
            } 
            console.log(`Collected ${artistAlbumTrackCount} potential album tracks.`);

            // --- Fetch Top Tracks ---
            console.log(`Sampling ${ARTIST_SAMPLE_COUNT_TOP} artists for top tracks.`);
            let artistsToSampleTop = this.shuffleArray([...this.fullFollowedArtists]).slice(0, ARTIST_SAMPLE_COUNT_TOP);
            let artistTopTrackCount = 0;
             for (const artist of artistsToSampleTop) {
                  await this.delay(150);
                  try {
                      const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
                      topTracksData?.tracks?.forEach((track: SpotifyTrack) => {
                          if (track?.id && !fetchedTrackIds.has(track.id)) {
                              fetchedTrackIds.add(track.id);
                              topTrackPool.push({ track: track, sourceType: 'followedArtistTopTrack', sourceName: artist.name });
                              artistTopTrackCount++;
                          }
                      });
                  } catch (err) { console.warn(`Could not get top tracks for artist ${artist.id}`, err); }
             }
             console.log(`Collected ${artistTopTrackCount} potential top tracks.`);             
             // Combine pools for processing AFTER fetching separately for this mode
             rawTrackList.push(...albumTrackPool, ...topTrackPool);
        } // --- End Followed Artists Only Logic ---


        // --- B: Playlists Only ---
        else if (this.selectedSourceMode === 'playlistsOnly') {
            if (this.fullUserPlaylists.length === 0) { await this.loadAllUserPlaylists(); }
            if (this.fullUserPlaylists.length === 0) { throw new Error("No playlists loaded for 'Playlists Only' mode."); }

            this.generatingMixStatus = 'Fetching tracks from your playlists...'; this.cdRef.detectChanges();
            const playlistsToSample = this.shuffleArray([...this.fullUserPlaylists]).slice(0, PLAYLIST_SAMPLE_COUNT);
            console.log(`Selected ${playlistsToSample.length} playlists to sample.`);
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
                            rawTrackList.push({ track: track, sourceType: 'playlist', sourceName: playlist.name });
                            playlistFetchedCount++;
                         }
                    });
                } catch (listErr) { console.warn(`Could not fetch tracks for playlist ${playlist.name || playlist.id}`, listErr); }
            }
            console.log(`Collected ${playlistFetchedCount} unique tracks from ${playlistsToSample.length} playlists.`);
        } // --- End Playlist Logic ---

        // --- C: Mix (Followed Artists + Playlists) ---
        else if (this.selectedSourceMode === 'mix') {
            let playlistFetchedCount = 0;
            let artistTopTrackCount = 0;

            // --- Fetch Playlist Tracks ---
            if (this.fullUserPlaylists.length === 0) { await this.loadAllUserPlaylists(); }
            if (this.fullUserPlaylists.length === 0) { console.warn("No playlists loaded for 'Mix' mode playlist part."); }
            else {
                this.generatingMixStatus = 'Fetching tracks from playlists...'; this.cdRef.detectChanges();
                const playlistsToSample = this.shuffleArray([...this.fullUserPlaylists]).slice(0, PLAYLIST_SAMPLE_COUNT);
                console.log(`Selected ${playlistsToSample.length} playlists to sample for 'Mix'.`);
                for (const playlist of playlistsToSample) { 
                     if (!playlist?.id) continue;
                     await this.delay(150);
                     try {
                         const tracksInPlaylist = await this.spotifyService.getAllPlaylistTracks(playlist.id);
                         const sampledTracks = this.shuffleArray(tracksInPlaylist).slice(0, PLAYLIST_SAMPLE_SIZE);
                         sampledTracks.forEach((track: SpotifyTrack) => {
                              if (track?.id && !fetchedTrackIds.has(track.id)) {
                                  fetchedTrackIds.add(track.id);
                                  rawTrackList.push({ track: track, sourceType: 'playlist', sourceName: playlist.name });
                                  playlistFetchedCount++;
                              }
                         });
                     } catch(listErr) { console.warn(`Could not fetch tracks for playlist ${playlist.name || playlist.id}`, listErr); }
                }
                console.log(`Collected ${playlistFetchedCount} unique tracks from playlists for 'Mix'.`);                
            } // End playlist fetch for Mix

             // --- Fetch Followed Artist Top Tracks ---
            if (this.fullFollowedArtists.length === 0) { await this.loadAllFollowedArtists(); }
            if (this.fullFollowedArtists.length === 0) { console.warn("No followed artists loaded for 'Mix' mode artist part."); }
            else {
                this.generatingMixStatus = 'Fetching tracks from followed artists...'; this.cdRef.detectChanges();
                const artistsToSample = this.shuffleArray([...this.fullFollowedArtists]).slice(0, ARTIST_SAMPLE_COUNT_TOP); 
                console.log(`Selected ${artistsToSample.length} followed artists for top track sampling for 'Mix'.`);
                for (const artist of artistsToSample) {
                     await this.delay(150);
                     try {
                         const topTracksData = await this.spotifyService.getArtistTopTracks(artist.id);
                         topTracksData?.tracks?.forEach((track: SpotifyTrack) => {
                             if (track?.id && !fetchedTrackIds.has(track.id)) {
                                  fetchedTrackIds.add(track.id);
                                  rawTrackList.push({ track: track, sourceType: 'followedArtistTopTrack', sourceName: artist.name });
                                  artistTopTrackCount++;
                             }
                         });
                     } catch (err) { console.warn(`Could not get top tracks for followed artist ${artist.id} during mix`, err); }
                }
                console.log(`Collected ${artistTopTrackCount} unique top tracks from followed artists for 'Mix'.`);
            } // End artist fetch for Mix
        } // --- End Mix Mode ---


        // --- STEP 2: Process Tracks ---
        this.generatingMixStatus = 'Processing tracks...'; this.cdRef.detectChanges();
        console.log(`Total raw unique tracks collected: ${rawTrackList.length}`);
        if (rawTrackList.length === 0) throw new Error("Could not find any source tracks.");

        let processedTracks: GeneratedTrackInfo[] = [...rawTrackList];
        // De-duplicate
        processedTracks = Array.from(new Map(processedTracks.map(item => [item.track.id, item])).values());
        console.log(`Tracks after de-duplication: ${processedTracks.length}`);

        // Apply Artist Cap
        console.log(`Applying artist cap (max 2 per artist)...`);
        const artistTrackCount: { [artistId: string]: number } = {};
        let cappedTracks: GeneratedTrackInfo[] = []; // Define inside try block
        processedTracks = this.shuffleArray(processedTracks); 
        for (const item of processedTracks) { 
          const primaryArtistId = item.track.artists?.[0]?.id;
            if (primaryArtistId) {
                const currentCount = artistTrackCount[primaryArtistId] || 0;
                if (currentCount < 2) { cappedTracks.push(item); artistTrackCount[primaryArtistId] = currentCount + 1; }
            } else { 
              console.warn("Track with no primary artist:", item.track.name); cappedTracks.push(item); 
            } 
        }
        processedTracks = cappedTracks;
        console.log(`Tracks after artist cap: ${processedTracks.length}`);

        // --- Final Selection ---
        if (this.selectedSourceMode === 'followedOnly') {
            console.log(`Selecting final list for 'followedOnly'. Target: ${TARGET_ALBUM_TRACKS} album, ${TARGET_TOP_TRACKS} top.`);
            const finalMix: GeneratedTrackInfo[] = [];
            // Separate capped tracks by source AFTER capping
            const cappedAlbumTracks = this.shuffleArray(processedTracks.filter(t => t.sourceType === 'followedArtistAlbum'));
            const cappedTopTracks = this.shuffleArray(processedTracks.filter(t => t.sourceType === 'followedArtistTopTrack'));

            finalMix.push(...cappedAlbumTracks.slice(0, TARGET_ALBUM_TRACKS)); 
            const neededTop = this.selectedLength - finalMix.length;
            if (neededTop > 0) { 
                 console.log(`Adding ${neededTop} top tracks.`);
                 finalMix.push(...cappedTopTracks.slice(0, neededTop)); 
            }
            
             const neededMore = this.selectedLength - finalMix.length;
             if(neededMore > 0) {
                 console.log(`Still short ${neededMore} tracks. Adding remaining...`);
                 // Add remaining from either pool, ensuring no duplicates within finalMix itself
                 const currentIds = new Set(finalMix.map(item => item.track.id));
                 const remainingTop = cappedTopTracks.slice(finalMix.filter(t => t.sourceType === 'followedArtistTopTrack').length);
                 const remainingAlbum = cappedAlbumTracks.slice(finalMix.filter(t => t.sourceType === 'followedArtistAlbum').length);
                 [...remainingTop, ...remainingAlbum].forEach(item => {
                     if (finalMix.length < this.selectedLength && !currentIds.has(item.track.id)) {
                         finalMix.push(item);
                         currentIds.add(item.track.id);
                     }
                 });
             }
            this.generatedTracks = finalMix.slice(0, this.selectedLength); // Ensure exact length
        } else {
             // For 'mix' and 'playlistsOnly', just shuffle the capped list and slice
             this.generatedTracks = this.shuffleArray(processedTracks).slice(0, this.selectedLength);
        }        
        console.log(`Final track list length: ${this.generatedTracks.length}.`);
        if (this.selectedSourceMode === 'followedOnly') {
             console.log(` -> Contains ${this.generatedTracks.filter(t=>t.sourceType === 'followedArtistAlbum').length} album tracks and ${this.generatedTracks.filter(t=>t.sourceType === 'followedArtistTopTrack').length} top tracks.`);
        }
        if (this.generatedTracks.length === 0) { this.generationError = "No tracks matched criteria after processing."; }
    } catch (err: any) {
        this.handleError(err, 'An error occurred while generating the mix.');
        this.generationError = this.feedbackMessage?.text || 'Generation failed.'; 
        this.feedbackMessage = null; 
    } finally {
        this.generatingMix = false;
        this.generatingMixStatus = ''; 
        this.cdRef.detectChanges();
    }
  } // --- End generateMix ---

  private mapAlbumTrackToFullTrack(albumTrack: SpotifyAlbumTrack, sourceAlbum: SpotifyArtistAlbum): SpotifyTrack {
    if (!albumTrack) {
        // Should not happen if called correctly, but good practice
        console.error("mapAlbumTrackToFullTrack called with null/undefined albumTrack");
        // Return a default or throw an error depending on how you want to handle
        return {} as SpotifyTrack; // Return empty object cast to type (handle with care)
    }    
    return {
        // --- Properties directly from SpotifyAlbumTrack ---
        id: albumTrack.id,
        name: albumTrack.name,
        uri: albumTrack.uri,
        artists: albumTrack.artists, // Assume artist structure is compatible
        duration_ms: albumTrack.duration_ms,
        explicit: albumTrack.explicit,
        is_local: albumTrack.is_local ?? false, // Default to false if missing
        preview_url: albumTrack.preview_url,
        // popularity: undefined, // AlbumTrack often doesn't have popularity

        // --- Properties derived/added from sourceAlbum ---
        album: { // Create the nested album object
            id: sourceAlbum.id,
            name: sourceAlbum.name,
            uri: sourceAlbum.uri,
            release_date: sourceAlbum.release_date,
            images: sourceAlbum.images, // Use images from the source album
            artists: sourceAlbum.artists, // Include artists from source album if needed
            album_type: sourceAlbum.album_type // Include album type
        },
        // External URLs might be missing on AlbumTrack, get from album if needed
        external_urls: { 
            spotify: `https://open.spotify.com/track/${albumTrack.id}` // Construct track URL manually if needed
            // Or potentially use sourceAlbum.external_urls?.spotify if relevant
        },
    };
  }

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
