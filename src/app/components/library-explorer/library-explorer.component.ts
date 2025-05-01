import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
    SpotifyService,
    SpotifyArtist,
    SpotifyPlaylist,
    SpotifyAlbum,
    SpotifySavedAlbumObject
} from '../../services/spotify.service'; 

interface FeedbackMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}
type LibraryTab = 'artists' | 'albums' | 'playlists';
type SortDirection = 'asc' | 'desc';

type PlaylistSortKey = 'name' | 'owner' | 'tracks';
type ArtistSortKey = 'name' | 'popularity' | 'followers';
type AlbumSortKey = 'albumName' | 'artistName' | 'releaseDate' | 'popularity' | 'addedDate';

@Component({
  selector: 'app-library-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './library-explorer.component.html',
  styleUrls: ['./library-explorer.component.scss']
})
export class LibraryExplorerComponent implements OnInit, OnDestroy {

  // State
  activeTab: LibraryTab = 'playlists'; // Default tab
  isLoggedIn: boolean = false;
  spotifyUserId: string | null = null;

  // Data - Full lists from API
  allFollowedArtists: SpotifyArtist[] = [];
  allSavedAlbums: SpotifySavedAlbumObject[] = []; // Use specific type
  allUserPlaylists: SpotifyPlaylist[] = [];

  // Data - Filtered lists for display
  filteredArtists: SpotifyArtist[] = [];
  filteredAlbums: SpotifySavedAlbumObject[] = [];
  filteredPlaylists: SpotifyPlaylist[] = [];

  // Filter Inputs
  artistFilter: string = '';
  albumFilter: string = '';
  playlistFilter: string = '';

  // Loading States
  loadingArtists: boolean = false;
  loadingAlbums: boolean = false;
  loadingPlaylists: boolean = false;
  feedbackMessage: FeedbackMessage | null = null;
  private feedbackTimeout: any = null;

  // --- Search State ---
  showSearchResults: boolean = false;
  searchQuery: string = ''; 
  searchResults: any[] = []; // Store combined results with type info
  isSearching: boolean = false;
  searchError: string | null = null;
  // Keep track of added items to update button state
  addedItemIds = new Set<string>(); 
  // Add state for specific add action feedback
  // addSuccessMessage: string | null = null;
  // addErrorMessage: string | null = null;

  // --- Sorting State ---
  playlistSortKey: PlaylistSortKey = 'name'; // Default sort
  playlistSortDirection: SortDirection = 'asc';
  
  artistSortKey: ArtistSortKey = 'name'; // Default sort
  artistSortDirection: SortDirection = 'asc';
  
  albumSortKey: AlbumSortKey = 'addedDate'; // Default sort (newest first)
  albumSortDirection: SortDirection = 'desc';

  loadingProfile: boolean = false;
  error?: string | null;

  constructor(
    public spotifyService: SpotifyService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.spotifyService.isLoggedIn();
        if (this.isLoggedIn) {
            // Call the correct initial data loading method
            this.loadInitialData(); 
        }
  }

  ngOnDestroy(): void {
    if (this.feedbackTimeout) { clearTimeout(this.feedbackTimeout); }
  }
  loadInitialData(): void {
    console.log("[DEBUG] loadInitialData called."); // Add this to confirm execution
    this.loadUserProfile();     // <<< ENSURE THIS CALL IS PRESENT
    this.loadArtists(); 
    this.loadPlaylists(); 
    this.loadAlbums();
  }

  async loadUserProfile(): Promise<void> {
    this.loadingProfile = true; // Set loading true
    this.error = null;
    this.spotifyUserId = null; // Reset before fetching
    console.log("[Component DEBUG] loadUserProfile started. loadingProfile=true");
    try {
      const profile = await this.spotifyService.getUserProfile();
      console.log("[Component DEBUG] Profile data received in component:", JSON.stringify(profile)); 
      if (profile && profile.id) {
        this.spotifyUserId = profile.id; 
        console.log('[Component DEBUG] SUCCESSFULLY assigned this.spotifyUserId =', this.spotifyUserId); // Verify assignment
      } else {
          console.error('[Component DEBUG] Profile data received, but ID property is missing or invalid.', profile);
          this.handleError({ message: "User profile data invalid." }, "Could not load user profile ID.");
          this.spotifyUserId = null; // Ensure it remains null on failure
      }
    } catch (err: any) { 
        this.handleError(err, "Could not load user profile."); 
        this.spotifyUserId = null; // Ensure it's null on catch
    }
    finally {
      this.loadingProfile = false; 
      console.log('[Component DEBUG] loadUserProfile finally block. loadingProfile =', this.loadingProfile, 'spotifyUserId =', this.spotifyUserId); // Verify final state
      this.cdRef.detectChanges(); // Trigger change detection
    }
  }

  // --- Tab Selection & Data Loading ---
  selectTab(tab: LibraryTab): void {
    console.log(`Selecting tab: ${tab}`);
    this.activeTab = tab;
    this.clearActionFeedback();

    // Load data if not already loaded
    if (tab === 'artists' && this.allFollowedArtists.length === 0 && !this.loadingArtists) {
      this.loadArtists();
    } else if (tab === 'albums' && this.allSavedAlbums.length === 0 && !this.loadingAlbums) {
      this.loadAlbums();
    } else if (tab === 'playlists' && this.allUserPlaylists.length === 0 && !this.loadingPlaylists) {
      this.loadPlaylists();
    } else {
      // Data already loaded or is loading, just apply filter
      this.applyFilterAndSort();
    }
  }

  async loadArtists(): Promise<void> {
    if (this.loadingArtists) return;
    this.loadingArtists = true; 
    console.log("Loading followed artists...");
    try {
      this.allFollowedArtists = await this.spotifyService.getAllFollowedArtists();
      this.applyFilterAndSort(); // Apply filter after loading
      console.log(`Loaded ${this.allFollowedArtists.length} artists.`);
    } catch (err: any) { this.handleError(err, "Failed to load followed artists."); }
    finally { this.loadingArtists = false; this.cdRef.detectChanges(); }
  }

  async loadAlbums(): Promise<void> {
    if (this.loadingAlbums) return;
    this.loadingAlbums = true;
    console.log("Loading saved albums...");
    try {
      this.allSavedAlbums = await this.spotifyService.getAllSavedAlbums();
      this.applyFilterAndSort();
      console.log(`Loaded ${this.allSavedAlbums.length} albums.`);
    } catch (err: any) { this.handleError(err, "Failed to load saved albums."); }
     finally { this.loadingAlbums = false; this.cdRef.detectChanges(); }
  }

  async loadPlaylists(): Promise<void> {
    if (this.loadingPlaylists) return;
    this.loadingPlaylists = true;
    console.log("Loading user playlists...");
    try {
      const playlists = await this.spotifyService.getAllUserPlaylists();
      this.allUserPlaylists = playlists.filter(p => p.tracks?.total > 0); // Keep non-empty filter
      this.applyFilterAndSort();
       console.log(`Loaded ${this.allUserPlaylists.length} non-empty playlists.`);
    } catch (err: any) { this.handleError(err, "Failed to load user playlists."); }
     finally { this.loadingPlaylists = false; this.cdRef.detectChanges(); }
  }
 
  private showFeedback(type: FeedbackMessage['type'], text: string, durationMs: number = 4000): void {
    console.log(`Feedback (${type}): ${text}`);
    // Clear previous timeout if one exists
    if (this.feedbackTimeout) {
        clearTimeout(this.feedbackTimeout);
    }
    
    this.feedbackMessage = { type, text };
    this.cdRef.detectChanges(); // Ensure message appears

    // Set new timeout to clear the message
    this.feedbackTimeout = setTimeout(() => {
        this.feedbackMessage = null;
        this.cdRef.detectChanges(); // Ensure message disappears
    }, durationMs);
  }

 
 // --- Helper to clear messages ---
  clearActionFeedback(): void {
    if (this.feedbackTimeout) {
        clearTimeout(this.feedbackTimeout);
    }
    this.feedbackMessage = null;
  }
  // --- Library Modification Actions ---
  async removeArtist(artist: SpotifyArtist, event: MouseEvent): Promise<void> {
    event.stopPropagation(); 
    console.log(`Attempting to unfollow artist: ${artist.id} - ${artist.name}`);
    this.clearActionFeedback(); // Clear previous messages
    try { 
        await this.spotifyService.unfollowArtist(artist.id);
        // Update local state
        this.allFollowedArtists = this.allFollowedArtists.filter(a => a.id !== artist.id);
        this.addedItemIds.delete(artist.id); // Update search button state
        this.applyFilterAndSort(); 
        // Show success message
        this.showFeedback('warning', `Unfollowed artist "${artist.name}".`);
        this.cdRef.detectChanges();
    } 
    catch (err: any) { 
        this.handleError(err, `Failed to unfollow artist "${artist.name}".`); // handleError sets generalError
    }
  }

  async removeAlbum(item: SpotifySavedAlbumObject, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const albumName = item.album.name; // Get name before potential removal
    const albumId = item.album.id;
    console.log(`Attempting to unsave album: ${albumId} - ${albumName}`);
    this.clearActionFeedback();
    try { 
        await this.spotifyService.unsaveAlbum(albumId);
         // Update local state
        this.allSavedAlbums = this.allSavedAlbums.filter(i => i.album.id !== albumId);
        this.addedItemIds.delete(albumId); // Update search button state
        this.applyFilterAndSort(); 
         // Show success message
         this.showFeedback('warning', `Unsaved album "${albumName}".`);
        this.cdRef.detectChanges();
    } 
    catch (err: any) { 
        this.handleError(err, `Failed to unsave album "${albumName}".`); 
    }
  }

  async removePlaylist(playlist: SpotifyPlaylist, event: MouseEvent): Promise<void> {
    event.stopPropagation(); 
    this.clearActionFeedback();
    // 1. Check if User ID is loaded
    if (!this.spotifyUserId) {
        this.handleError({ message: "User ID not loaded." }, "Cannot determine playlist ownership yet.");
        return; 
    }
    // 2. Determine Ownership
    const isOwner = playlist.owner?.id === this.spotifyUserId;
    // 3. Handle Owned Playlist Case
    if (isOwner) {
        const ownedMessage = `You own "${playlist.name}" and cannot unfollow/delete it here. Please manage it directly in Spotify.`;
        console.warn(ownedMessage);
        this.showFeedback('info', ownedMessage, 7000);        
        return; // Stop further execution
    }     
    // 4. Handle Followed Playlist Case (This code only runs if NOT the owner)    
    console.log(`Attempting to unfollow playlist: ${playlist.id}`);
    try {
        await this.spotifyService.unfollowPlaylist(playlist.id);
        // Update local state
        this.allUserPlaylists = this.allUserPlaylists.filter(p => p.id !== playlist.id);
        this.addedItemIds.delete(playlist.id); 
        this.applyFilterAndSort(); 
        this.showFeedback('warning', `Unfollowed playlist "${playlist.name}".`);
        this.cdRef.detectChanges();
    } catch (err: any) { 
        this.handleError(err, `Failed to unfollow playlist "${playlist.name}".`); 
    }    
  }

  getSearchPlaceholder(): string {
    switch(this.activeTab) {
        case 'artists': return 'Search Spotify for artists to follow...';
        case 'albums': return 'Search Spotify for albums to save...';
        case 'playlists': return 'Search Spotify for playlists to follow...';
        default: return 'Search Spotify...';
    }
  }
  
  async performSearch(): Promise<void> {
    const trimmedQuery = this.searchQuery.trim();  
    if (!trimmedQuery) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }  
    this.isSearching = true;
    this.searchError = null;
    this.searchResults = [];
    this.showSearchResults = true;
    this.clearActionFeedback();  
    const searchTypeMap: Record<string, 'artist' | 'album' | 'playlist'> = {
      artists: 'artist',
      albums: 'album',
      playlists: 'playlist',
    };  
    const apiSearchType = searchTypeMap[this.activeTab];
  
    if (!apiSearchType) {
      console.error('Invalid active tab for search:', this.activeTab);
      this.handleError(
        { message: 'Invalid search category selected.' },
        'Internal Search Error'
      );
      this.isSearching = false;
      this.cdRef.detectChanges();
      return;
    }  
    console.log(`Searching Spotify for type '${apiSearchType}': ${trimmedQuery}`);  
    try {
      const data = await this.spotifyService.search(trimmedQuery, apiSearchType);
  
      switch (apiSearchType) {
        case 'artist':
          this.searchResults = data.artists?.items.map((item: any) => ({
            ...item,
            resultType: 'artist',
          })) || [];
          break;
        case 'album':
          this.searchResults = data.albums?.items.map((item: any) => ({
            ...item,
            resultType: 'album',
          })) || [];
          break;
        case 'playlist':
          this.searchResults = data.playlists?.items.map((item: any) => ({
            ...item,
            resultType: 'playlist',
          })) || [];
          break;
      }  
      console.log(`Found ${this.searchResults.length} results.`);
    } catch (err: any) {
      this.handleError(err, `Failed to search for ${apiSearchType}.`);
      this.searchError =
        this.feedbackMessage?.text ||
        `Failed to search for ${apiSearchType}.`;
      this.feedbackMessage = null;
    } finally {
      this.isSearching = false;
      this.cdRef.detectChanges();
    }
  }
  

  closeSearchResults(): void {
    this.searchQuery = '';       // Clear search query
    this.searchResults = [];     // Clear results array
    this.searchError = null;     // Clear any search error
    this.showSearchResults = false; // Hide the results area
  }

  async addArtist(artist: SpotifyArtist): Promise<void> {
      if (!artist?.id || this.addedItemIds.has(artist.id)) return;
      console.log(`Attempting to follow artist: ${artist.name}`);
      this.clearActionFeedback();
      try {
          await this.spotifyService.followArtist(artist.id);
          this.addedItemIds.add(artist.id); // Mark as added
          this.showFeedback('success', `${artist.name} followed!`); 
          this.loadArtists();
      } catch (err: any) { this.handleError(err, `Failed to follow ${artist.name}.`); }

      finally { this.cdRef.detectChanges(); } // Update button state if needed
  }

  async addAlbum(album: SpotifyAlbum): Promise<void> {
      if (!album?.id || this.addedItemIds.has(album.id)) return;
      console.log(`Attempting to save album: ${album.name}`);
      this.clearActionFeedback();
      try {
          await this.spotifyService.saveAlbum(album.id);
          this.addedItemIds.add(album.id);
          this.showFeedback('success', `Album "${album.name}" saved!`);
          this.loadAlbums();
      } catch (err: any) { this.handleError(err, `Failed to save album ${album.name}.`); }
      finally { this.cdRef.detectChanges(); }
  }

  async addPlaylist(playlist: SpotifyPlaylist): Promise<void> {
      if (!playlist?.id || this.addedItemIds.has(playlist.id)) return;
        console.log(`Attempting to follow playlist: ${playlist.name}`);
        this.clearActionFeedback();      
      try {
          await this.spotifyService.followPlaylist(playlist.id);          
          this.addedItemIds.add(playlist.id);
          this.showFeedback('success', `Playlist "${playlist.name}" followed!`);           
          this.loadPlaylists();        
      } catch (err: any) { this.handleError(err, `Failed to follow playlist ${playlist.name}.`); }
      finally { this.cdRef.detectChanges(); }
  }

  onFilterInput(): void { // Simplified - just triggers the Subject
    this.applyFilterAndSort(); 
    this.cdRef.detectChanges(); 
  }

  // Combined Filter and Sort Method
  applyFilterAndSort(): void {
    console.log(`Applying filter and sort for tab: ${this.activeTab}`);
    const filterValue = (this.activeTab === 'artists' ? this.artistFilter :
                        this.activeTab === 'albums' ? this.albumFilter :
                        this.playlistFilter).toLowerCase().trim();

    let itemsToSort: any[] = [];

    // 1. Apply Text Filter (based on active tab)
    if (this.activeTab === 'artists') {
      itemsToSort = filterValue 
          ? this.allFollowedArtists.filter(artist => artist.name?.toLowerCase().includes(filterValue)) 
          : [...this.allFollowedArtists]; // Use copy for sorting
    } else if (this.activeTab === 'albums') {
      itemsToSort = filterValue 
          ? this.allSavedAlbums.filter(item =>
              item.album.name?.toLowerCase().includes(filterValue) ||
              item.album.artists?.some(artist => artist.name?.toLowerCase().includes(filterValue))
            ) 
          : [...this.allSavedAlbums]; // Use copy
    } else if (this.activeTab === 'playlists') {
      itemsToSort = filterValue 
          ? this.allUserPlaylists.filter(playlist =>
              playlist.name?.toLowerCase().includes(filterValue) ||
              playlist.owner?.display_name?.toLowerCase().includes(filterValue)
            ) 
          : [...this.allUserPlaylists]; // Use copy
    }
    
    // 2. Apply Sorting
    this.sortData(itemsToSort); // Sort the filtered items

    // 3. Update the correct filtered array
    if (this.activeTab === 'artists') this.filteredArtists = itemsToSort;
    else if (this.activeTab === 'albums') this.filteredAlbums = itemsToSort as SpotifySavedAlbumObject[];
    else if (this.activeTab === 'playlists') this.filteredPlaylists = itemsToSort as SpotifyPlaylist[];
    
    this.cdRef.detectChanges(); // Ensure view updates
  }

  // Method to set sort parameters and trigger update
  setSort(key: PlaylistSortKey | ArtistSortKey | AlbumSortKey): void {
    let currentKey: string = '';
    let currentDirection: SortDirection = 'asc';

    // Determine current settings based on active tab
    if (this.activeTab === 'playlists') { currentKey = this.playlistSortKey; currentDirection = this.playlistSortDirection; }
    else if (this.activeTab === 'artists') { currentKey = this.artistSortKey; currentDirection = this.artistSortDirection; }
    else if (this.activeTab === 'albums') { currentKey = this.albumSortKey; currentDirection = this.albumSortDirection; }
    
    // If clicking the same key, toggle direction; otherwise, set new key and default to 'asc'
    let newDirection: SortDirection = 'asc';
    if (currentKey === key) {
        newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    }

    console.log(`Setting sort for ${this.activeTab}: key=${key}, direction=${newDirection}`);

    // Update the correct state variables
    if (this.activeTab === 'playlists') { this.playlistSortKey = key as PlaylistSortKey; this.playlistSortDirection = newDirection; }
    else if (this.activeTab === 'artists') { this.artistSortKey = key as ArtistSortKey; this.artistSortDirection = newDirection; }
    else if (this.activeTab === 'albums') { this.albumSortKey = key as AlbumSortKey; this.albumSortDirection = newDirection; }

    // Re-apply filter and sort
    this.applyFilterAndSort();
  }

  // Sorting logic (operates on the passed array)
  private sortData(items: any[]): void {
    let sortKey: string = '';
    let sortDirection: SortDirection = 'asc';

    // Get sort settings for the current tab
    if (this.activeTab === 'playlists') { sortKey = this.playlistSortKey; sortDirection = this.playlistSortDirection; }
    else if (this.activeTab === 'artists') { sortKey = this.artistSortKey; sortDirection = this.artistSortDirection; }
    else if (this.activeTab === 'albums') { sortKey = this.albumSortKey; sortDirection = this.albumSortDirection; }
    else { return; } // Should not happen

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    items.sort((a, b) => {
        let valA: any;
        let valB: any;

        // Extract values based on activeTab and sortKey
        if (this.activeTab === 'playlists') {
            const pA = a as SpotifyPlaylist; const pB = b as SpotifyPlaylist;
            if (sortKey === 'name') { valA = pA.name?.toLowerCase(); valB = pB.name?.toLowerCase(); } 
            else if (sortKey === 'owner') { valA = pA.owner?.display_name?.toLowerCase() || pA.owner?.id; valB = pB.owner?.display_name?.toLowerCase() || pB.owner?.id; } 
            else if (sortKey === 'tracks') { valA = pA.tracks?.total ?? 0; valB = pB.tracks?.total ?? 0; }
        } else if (this.activeTab === 'artists') {
            const artA = a as SpotifyArtist; const artB = b as SpotifyArtist;
            if (sortKey === 'name') { valA = artA.name?.toLowerCase(); valB = artB.name?.toLowerCase(); } 
            else if (sortKey === 'popularity') { valA = artA.popularity ?? -1; valB = artB.popularity ?? -1; } // Use -1 for undefined
            else if (sortKey === 'followers') { valA = artA.followers?.total ?? 0; valB = artB.followers?.total ?? 0; }
        } else if (this.activeTab === 'albums') {
            const itemA = a as SpotifySavedAlbumObject; const itemB = b as SpotifySavedAlbumObject;
            if (sortKey === 'albumName') { valA = itemA.album.name?.toLowerCase(); valB = itemB.album.name?.toLowerCase(); } 
            else if (sortKey === 'artistName') { valA = itemA.album.artists?.[0]?.name?.toLowerCase(); valB = itemB.album.artists?.[0]?.name?.toLowerCase(); } // Sort by primary artist
            else if (sortKey === 'releaseDate') { valA = itemA.album.release_date; valB = itemB.album.release_date; } // Handle dates later
            else if (sortKey === 'popularity') { valA = itemA.album.popularity ?? -1; valB = itemB.album.popularity ?? -1; } 
            else if (sortKey === 'addedDate') { valA = itemA.added_at; valB = itemB.added_at; } // Handle dates later
        }

        // Comparison logic
        let comparison = 0;
        if (valA === null || valA === undefined) comparison = -1; // Put nulls/undefined first (or last if directionMultiplier is -1)
        else if (valB === null || valB === undefined) comparison = 1;
        else if (typeof valA === 'string' && typeof valB === 'string') {
            comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB;
        } else if (sortKey === 'releaseDate' || sortKey === 'addedDate') {
            // Handle date strings (newer first for desc, older first for asc)
            const dateA = new Date(valA || 0).getTime();
            const dateB = new Date(valB || 0).getTime();
            comparison = dateA - dateB; 
        }
        
        return comparison * directionMultiplier;
    });
  }

  // --- Helpers ---
  getArtistNames(artists: SpotifyArtist[] | undefined): string {
    if (!artists || artists.length === 0) return 'Unknown Artist';
    return artists.map(a => a.name).join(', ');
  }
  handleImageError(event: Event): void { /* ... implementation ... */ }

  login(): void { this.spotifyService.authorize('/library'); } // Redirect back here
  private handleError(err: any, defaultMessage: string): void {
    console.error(`Error: ${defaultMessage}`, err);
    const message = err?.message || defaultMessage;
    this.showFeedback('error', message, 7000); 
  }
}
