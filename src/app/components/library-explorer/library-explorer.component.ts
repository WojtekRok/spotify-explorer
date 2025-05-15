import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

// Import from barrel file
import {
  SpotifyService,
  SpotifyArtist,
  SpotifyPlaylist,
  SpotifyAlbum,
  SpotifySavedAlbumObject,
  LoggerService
} from '../../services';

interface FeedbackMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

type LibraryTab = 'artists' | 'albums' | 'playlists';
type SortDirection = 'asc' | 'desc';

type PlaylistSortKey = 'name' | 'owner' | 'tracks';
type ArtistSortKey = 'name' | 'popularity' | 'followers';
type AlbumSortKey = 'albumName' | 'artistName' | 'releaseDate' | 'popularity' | 'addedDate';

type ConfirmationActionType = 'unfollow-artist' | 'unsave-album' | 'unfollow-playlist' | 'owned-playlist-info';

/**
 * Component for exploring and managing the user's Spotify library
 * - View followed artists
 * - View saved albums
 * - View playlists
 * - Search and add new items
 */
@Component({
  selector: 'app-library-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './library-explorer.component.html',
  styleUrls: ['./library-explorer.component.scss']
})
export class LibraryExplorerComponent implements OnInit, OnDestroy {
  // --- Tab State ---
  activeTab: LibraryTab = 'playlists'; // Default tab
  
  // --- Auth State ---
  isLoggedIn = false;
  spotifyUserId: string | null = null;
  
  // --- Data - Full lists from API ---
  allFollowedArtists: SpotifyArtist[] = [];
  allSavedAlbums: SpotifySavedAlbumObject[] = [];
  allUserPlaylists: SpotifyPlaylist[] = [];

  // --- Data - Filtered lists for display ---
  filteredArtists: SpotifyArtist[] = [];
  filteredAlbums: SpotifySavedAlbumObject[] = [];
  filteredPlaylists: SpotifyPlaylist[] = [];

  // --- Text Filter Inputs ---
  artistFilter = '';
  albumFilter = '';
  playlistFilter = '';

  // --- Loading States ---
  loadingArtists = false;
  loadingAlbums = false;
  loadingPlaylists = false;
  loadingProfile = false;
  loadingConfirmationAction = false;
  
  // --- Error State ---
  error: string | null = null;
  
  // --- Feedback Messages ---
  feedbackMessage: FeedbackMessage | null = null;
  private feedbackTimeout: any = null;

  // --- Search State ---
  showSearchResults = false;
  searchQuery = ''; 
  searchResults: any[] = []; // Store combined results with type info
  isSearching = false;
  searchError: string | null = null;
  addedItemIds = new Set<string>(); // Track added items to update button state
  
  // --- Debounce Search Input ---
  private searchQueryChanged = new Subject<string>();
  private searchSubscription: Subscription | null = null;
  
  // --- Sorting State ---
  playlistSortKey: PlaylistSortKey = 'name';
  playlistSortDirection: SortDirection = 'asc';
  
  artistSortKey: ArtistSortKey = 'name';
  artistSortDirection: SortDirection = 'asc';
  
  albumSortKey: AlbumSortKey = 'addedDate'; // Default sort (newest first)
  albumSortDirection: SortDirection = 'desc';

  // --- Confirmation Dialog State ---
  showConfirmDialog = false;
  itemToConfirm: SpotifyArtist | SpotifySavedAlbumObject | SpotifyPlaylist | null = null;
  confirmActionType: ConfirmationActionType | null = null;
  
  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    public spotifyService: SpotifyService,
    private logger: LoggerService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state observable
    this.spotifyService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        if (this.isLoggedIn) {
          this.loadInitialData();
        }
      });
      
    this.setupSearchDebounce();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    this.searchSubscription?.unsubscribe();
    
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

  /**
   * Load initial data for the library
   */
  loadInitialData(): void {
    this.logger.log("Loading initial library data");
    this.loadUserProfile();
    this.loadArtists();
    this.loadPlaylists();
    this.loadAlbums();
  }

  /**
   * Load the user profile data
   */
  async loadUserProfile(): Promise<void> {
    this.loadingProfile = true;
    this.error = null;
    this.spotifyUserId = null; // Reset before fetching
    
    this.logger.log("Loading user profile data");
    
    try {
      const profile = await this.spotifyService.getUserProfile();
      
      if (profile && profile.id) {
        this.spotifyUserId = profile.id;
        this.logger.log(`User profile loaded, ID: ${this.spotifyUserId}`);
      } else {
        this.logger.error("Profile data received, but ID property is missing or invalid");
        this.handleError({ message: "User profile data invalid." }, "Could not load user profile ID.");
        this.spotifyUserId = null;
      }
    } catch (err: any) {
      this.handleError(err, "Could not load user profile.");
      this.spotifyUserId = null;
    } finally {
      this.loadingProfile = false;
      this.cdRef.detectChanges();
    }
  }

  /**
   * Setup debounce for search input
   */
  setupSearchDebounce(): void {
    this.searchSubscription = this.searchQueryChanged.pipe(
      debounceTime(400), // Wait for 400ms pause in typing
      distinctUntilChanged() // Only emit if value has changed
    ).subscribe(query => {
      // Perform search only if query is not empty after debounce
      if (query.trim()) {
        this.performSearch(query);
      } else {
        // If query becomes empty, clear results
        this.searchResults = [];
        this.showSearchResults = false;
        this.searchError = null;
        this.cdRef.detectChanges();
      }
    });
  }

  /**
   * Handle search input changes
   */
  onSearchQueryInput(): void {
    // Push the current value of searchQuery onto the Subject
    this.searchQueryChanged.next(this.searchQuery);
  }

  /**
   * Switch to a tab and load data if needed
   */
  selectTab(tab: LibraryTab): void {
    this.logger.log(`Selecting tab: ${tab}`);
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

  /**
   * Load followed artists
   */
  async loadArtists(): Promise<void> {
    if (this.loadingArtists) return;
    
    this.loadingArtists = true;
    this.logger.log("Loading followed artists...");
    
    try {
      this.allFollowedArtists = await this.spotifyService.getAllFollowedArtists();
      this.applyFilterAndSort(); // Apply filter after loading
      this.logger.log(`Loaded ${this.allFollowedArtists.length} artists`);
    } catch (err: any) {
      this.handleError(err, "Failed to load followed artists.");
    } finally {
      this.loadingArtists = false;
      this.cdRef.detectChanges();
    }
  }

  /**
   * Load saved albums
   */
  async loadAlbums(): Promise<void> {
    if (this.loadingAlbums) return;
    
    this.loadingAlbums = true;
    this.logger.log("Loading saved albums...");
    
    try {
      this.allSavedAlbums = await this.spotifyService.getAllSavedAlbums();
      this.applyFilterAndSort();
      this.logger.log(`Loaded ${this.allSavedAlbums.length} albums`);
    } catch (err: any) {
      this.handleError(err, "Failed to load saved albums.");
    } finally {
      this.loadingAlbums = false;
      this.cdRef.detectChanges();
    }
  }

  /**
   * Load user playlists
   */
  async loadPlaylists(): Promise<void> {
    if (this.loadingPlaylists) return;
    
    this.loadingPlaylists = true;
    this.logger.log("Loading user playlists...");
    
    try {
      const playlists = await this.spotifyService.getAllUserPlaylists();
      this.allUserPlaylists = playlists.filter(p => p.tracks?.total > 0); // Keep non-empty filter
      this.applyFilterAndSort();
      this.logger.log(`Loaded ${this.allUserPlaylists.length} non-empty playlists`);
    } catch (err: any) {
      this.handleError(err, "Failed to load user playlists.");
    } finally {
      this.loadingPlaylists = false;
      this.cdRef.detectChanges();
    }
  }

  /**
   * Show a feedback message to the user
   */
  private showFeedback(type: FeedbackMessage['type'], text: string, durationMs = 4000): void {
    this.logger.log(`Feedback (${type}): ${text}`);
    
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

  /**
   * Clear feedback messages
   */
  clearActionFeedback(): void {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    this.feedbackMessage = null;
  }

  // --- Confirmation Dialog Methods ---
  /**
   * Open confirmation dialog for removal action
   */
  confirmRemoval(item: SpotifyArtist | SpotifySavedAlbumObject | SpotifyPlaylist, type: 'artist' | 'album' | 'playlist', event: MouseEvent): void {
    event.stopPropagation(); // Prevent list item click behavior if any
    this.clearActionFeedback(); // Clear any existing feedback

    // Specific check for owned playlists
    if (type === 'playlist' && (item as SpotifyPlaylist).owner?.id === this.spotifyUserId) {
      this.itemToConfirm = item;
      this.confirmActionType = 'owned-playlist-info'; // Special type for owned playlist
      this.showConfirmDialog = true;
      if ('id' in item) {
        this.logger.log(`Confirming removal for owned playlist: ${item.id}. Showing info dialog.`);
      } else {
        this.logger.warn('Item does not have an ID property.');
      }
    } else {
      // Standard confirmation for unfollow/unsave
      const actionMap: Record<'artist' | 'album' | 'playlist', ConfirmationActionType> = {
        artist: 'unfollow-artist',
        album: 'unsave-album',
        playlist: 'unfollow-playlist',
      };
      
      this.itemToConfirm = item;
      this.confirmActionType = actionMap[type];
      this.showConfirmDialog = true;
      this.logger.log(`Confirming removal for ${type}: ${type === 'album' ? (item as SpotifySavedAlbumObject).album.id : (item as SpotifyArtist | SpotifyPlaylist).id}`);
    }
    this.cdRef.detectChanges();
  }
  /**
   * Handle the confirmed action
   */
  async handleConfirmation(): Promise<void> {
    if (!this.itemToConfirm || !this.confirmActionType || this.confirmActionType === 'owned-playlist-info') {
      // Should not happen for non-info types, or just close info dialog
      this.cancelConfirmation();
      return;
    }

    this.loadingConfirmationAction = true;
    this.clearActionFeedback(); // Clear feedback before showing new one

    try {
      if (this.confirmActionType === 'unfollow-artist') {
        await this.performUnfollowArtist(this.itemToConfirm as SpotifyArtist);
      } else if (this.confirmActionType === 'unsave-album') {
        await this.performUnsaveAlbum(this.itemToConfirm as SpotifySavedAlbumObject);
      } else if (this.confirmActionType === 'unfollow-playlist') {
        await this.performUnfollowPlaylist(this.itemToConfirm as SpotifyPlaylist);
      }
    } catch (err: any) {
      // Error handled within the perform methods
    } finally {
      this.loadingConfirmationAction = false;
      this.cancelConfirmation(); // Always close dialog after action attempt
      this.cdRef.detectChanges();
    }
  }

  /**
   * Cancel the confirmation dialog
   */
  cancelConfirmation(): void {
    this.showConfirmDialog = false;
    this.itemToConfirm = null;
    this.confirmActionType = null;
    this.loadingConfirmationAction = false; // Ensure loading is off
    this.cdRef.detectChanges();
  }

  // --- Actual Removal Logic (Called AFTER Confirmation) ---
  /**
   * Unfollow an artist (internal after confirmation)
   */
  private async performUnfollowArtist(artist: SpotifyArtist): Promise<void> {
    this.logger.log(`Performing unfollow artist: ${artist.id} - ${artist.name}`);
    try {
      await this.spotifyService.unfollowArtist(artist.id);
      
      // Update local state
      this.allFollowedArtists = this.allFollowedArtists.filter(a => a.id !== artist.id);
      this.addedItemIds.delete(artist.id); // Update search button state
      this.applyFilterAndSort();
      
      // Show success message
      this.showFeedback('warning', `Unfollowed artist "${artist.name}".`);
    } catch (err: any) {
      this.handleError(err, `Failed to unfollow artist "${artist.name}".`);
    }
  }

  /**
   * Remove an album from library (internal after confirmation)
   */
  private async performUnsaveAlbum(item: SpotifySavedAlbumObject): Promise<void> {
    const albumName = item.album.name;
    const albumId = item.album.id;
    
    this.logger.log(`Performing unsave album: ${albumId} - ${albumName}`);
    
    try {
      await this.spotifyService.unsaveAlbum(albumId);
      
      // Update local state
      this.allSavedAlbums = this.allSavedAlbums.filter(i => i.album.id !== albumId);
      this.addedItemIds.delete(albumId); // Update search button state
      this.applyFilterAndSort();
      
      // Show success message
      this.showFeedback('warning', `Unsaved album "${albumName}".`);
    } catch (err: any) {
      this.handleError(err, `Failed to unsave album "${albumName}".`);
    }
  }

  /**
   * Unfollow a playlist (internal after confirmation, assumes not owned)
   */
  private async performUnfollowPlaylist(playlist: SpotifyPlaylist): Promise<void> {
     // This should only be called if the confirmActionType is 'unfollow-playlist',
     // meaning the ownership check already passed in confirmRemoval.
    
    this.logger.log(`Performing unfollow playlist: ${playlist.id}`);
    
    try {
      await this.spotifyService.unfollowPlaylist(playlist.id);
      
      // Update local state
      this.allUserPlaylists = this.allUserPlaylists.filter(p => p.id !== playlist.id);
      this.addedItemIds.delete(playlist.id);
      this.applyFilterAndSort();
      
      this.showFeedback('warning', `Unfollowed playlist "${playlist.name}".`);
    } catch (err: any) {
      this.handleError(err, `Failed to unfollow playlist "${playlist.name}".`);
    }
  }
  getItemName(item: any): string {
    if (item && 'name' in item) {
      return item.name;
    }
    return 'Unknown Item';
  }

  getAlbumName(item: any): string {
    if (item && 'album' in item && item.album) {
      return item.album.name;
    }
    return 'Unknown Album';
  }
  // --- End Confirmation Dialog Methods ---

  /**
   * Unfollow an artist
   */
  async removeArtist(artist: SpotifyArtist, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.logger.log(`Attempting to unfollow artist: ${artist.id} - ${artist.name}`);
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
    } catch (err: any) {
      this.handleError(err, `Failed to unfollow artist "${artist.name}".`);
    }
  }

  /**
   * Remove an album from library
   */
  async removeAlbum(item: SpotifySavedAlbumObject, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const albumName = item.album.name;
    const albumId = item.album.id;
    
    this.logger.log(`Attempting to unsave album: ${albumId} - ${albumName}`);
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
    } catch (err: any) {
      this.handleError(err, `Failed to unsave album "${albumName}".`);
    }
  }

  /**
   * Unfollow a playlist (or show message if owned)
   */
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
      this.logger.warn(ownedMessage);
      this.showFeedback('info', ownedMessage, 7000);
      return;
    }
    
    // 4. Handle Followed Playlist Case (This code only runs if NOT the owner)
    this.logger.log(`Attempting to unfollow playlist: ${playlist.id}`);
    
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

  /**
   * Get search placeholder text based on active tab
   */
  getSearchPlaceholder(): string {
    switch (this.activeTab) {
      case 'artists': return 'Search Spotify for artists to follow...';
      case 'albums': return 'Search Spotify for albums to save...';
      case 'playlists': return 'Search Spotify for playlists to follow...';
      default: return 'Search Spotify...';
    }
  }

  /**
   * Perform search against Spotify API
   */
  async performSearch(debouncedQuery: string): Promise<void> {
    if (!debouncedQuery) {
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
      this.logger.error('Invalid active tab for search:', this.activeTab);
      this.handleError(
        { message: 'Invalid search category selected.' },
        'Internal Search Error'
      );
      this.isSearching = false;
      this.cdRef.detectChanges();
      return;
    }
    
    this.logger.log(`Searching Spotify for type '${apiSearchType}': ${debouncedQuery}`);
    
    try {
      const data = await this.spotifyService.search(debouncedQuery, apiSearchType, 50);
      let rawResults: any[] = [];
      
      switch (apiSearchType) {
        case 'artist':
          rawResults = data.artists?.items || [];
          break;
        case 'album':
          rawResults = data.albums?.items || [];
          break;
        case 'playlist':
          rawResults = data.playlists?.items || [];
          // Filter out incomplete/invalid results
          const originalCount = rawResults.length;
          rawResults = rawResults.filter(item =>
            item &&
            item.id &&
            item.name && // Ensure name exists
            item.external_urls?.spotify // Ensure Spotify link exists
          );
          this.logger.log(`Filtered incomplete playlists: Kept ${rawResults.length} out of ${originalCount}`);
          break;
      }
      
      this.searchResults = rawResults.map(item => {
        // Check if the item is already in the user's library
        let isInLibrary = false;
        
        if (apiSearchType === 'artist') {
          isInLibrary = this.allFollowedArtists.some(a => a.id === item.id);
        } else if (apiSearchType === 'album') {
          isInLibrary = this.allSavedAlbums.some(a => a.album.id === item.id);
        } else if (apiSearchType === 'playlist') {
          isInLibrary = this.allUserPlaylists.some(p => p.id === item.id);
        }
        
        // If it's in library, add it to addedItemIds Set
        if (isInLibrary) {
          this.addedItemIds.add(item.id);
        }
        
        return {
          ...item,
          resultType: apiSearchType,
          isInLibrary: isInLibrary
        };
      });
      
      this.logger.log(`Found ${this.searchResults.length} results`);
      
      if (this.searchResults.length === 0) {
        this.searchError = `No displayable results found for "${debouncedQuery}".`;
      }
    } catch (err: any) {
      this.handleError(err, `Failed to search for ${apiSearchType}.`);
      this.searchError = this.feedbackMessage?.text || `Failed to search for ${apiSearchType}.`;
      this.feedbackMessage = null;
    } finally {
      this.isSearching = false;
      this.cdRef.detectChanges();
    }
  }

  /**
   * Close search results panel
   */
  closeSearchResults(): void {
    this.searchQuery = ''; // Clear search query
    this.searchResults = []; // Clear results array
    this.searchError = null; // Clear any search error
    this.showSearchResults = false; // Hide the results area
    this.clearActionFeedback();
    
    // Ensure debounce triggers clearing if needed
    this.searchQueryChanged.next('');
    this.cdRef.detectChanges();
  }

  /**
   * Follow an artist
   */
  async addArtist(artist: SpotifyArtist): Promise<void> {
    if (!artist?.id || this.addedItemIds.has(artist.id)) return;
    
    this.logger.log(`Attempting to follow artist: ${artist.name}`);
    this.clearActionFeedback();
    
    try {
      await this.spotifyService.followArtist(artist.id);
      
      this.addedItemIds.add(artist.id); // Mark as added
      this.showFeedback('success', `${artist.name} followed!`);
      
      // --- Add to local lists (NO Resort) ---
      if (!this.allFollowedArtists.some(a => a.id === artist.id)) {
        // Add to the beginning of the main array
        this.allFollowedArtists.unshift(artist);
        
        // If artists tab is active, add to beginning of filtered list too
        if (this.activeTab === 'artists') {
          this.filteredArtists.unshift(artist);
        }
        this.logger.log(`Artist ${artist.name} added locally.`);
      }
    } catch (err: any) {
      this.handleError(err, `Failed to follow ${artist.name}.`);
    } finally {
      this.cdRef.detectChanges(); // Update button state if needed
    }
  }

  /**
   * Save an album to library
   */
  async addAlbum(album: SpotifyAlbum): Promise<void> {
    if (!album?.id || this.addedItemIds.has(album.id)) return;
    
    this.logger.log(`Attempting to save album: ${album.name}`);
    this.clearActionFeedback();
    
    try {
      await this.spotifyService.saveAlbum(album.id);
      
      this.addedItemIds.add(album.id);
      this.showFeedback('success', `Album "${album.name}" saved!`);
      
      // --- Add to local lists (NO Resort) ---
      if (!this.allSavedAlbums.some(item => item.album.id === album.id)) {
        const savedAlbumObject: SpotifySavedAlbumObject = {
          added_at: new Date().toISOString(), // Use current time
          album: album
        };
        
        this.allSavedAlbums.unshift(savedAlbumObject);
        
        if (this.activeTab === 'albums') {
          this.filteredAlbums.unshift(savedAlbumObject);
        }
        this.logger.log(`Album ${album.name} added locally.`);
      }
    } catch (err: any) {
      this.handleError(err, `Failed to save album ${album.name}.`);
    } finally {
      this.cdRef.detectChanges();
    }
  }

  /**
   * Follow a playlist
   */
  async addPlaylist(playlist: SpotifyPlaylist): Promise<void> {
    if (!playlist?.id || this.addedItemIds.has(playlist.id)) return;
    
    this.logger.log(`Attempting to follow playlist: ${playlist.name}`);
    this.clearActionFeedback();
    
    try {
      await this.spotifyService.followPlaylist(playlist.id);
      
      this.addedItemIds.add(playlist.id);
      this.showFeedback('success', `Playlist "${playlist.name}" followed!`);
      
      // --- Add to local lists (NO Resort) ---
      if (!this.allUserPlaylists.some(p => p.id === playlist.id)) {
        this.allUserPlaylists.unshift(playlist);
        
        if (this.activeTab === 'playlists') {
          this.filteredPlaylists.unshift(playlist);
        }
        this.logger.log(`Playlist ${playlist.name} added locally.`);
      }
    } catch (err: any) {
      this.handleError(err, `Failed to follow playlist ${playlist.name}.`);
    } finally {
      this.cdRef.detectChanges();
    }
  }

  /**
   * Apply filter when input changes
   */
  onFilterInput(): void {
    this.applyFilterAndSort();
    this.cdRef.detectChanges();
  }

  /**
   * Combined Filter and Sort Method
   */
  applyFilterAndSort(): void {
    this.logger.log(`Applying filter and sort for tab: ${this.activeTab}`);
    
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

  /**
   * Set sort parameters and trigger update
   */
  setSort(key: PlaylistSortKey | ArtistSortKey | AlbumSortKey): void {
    let currentKey: string = '';
    let currentDirection: SortDirection = 'asc';

    // Determine current settings based on active tab
    if (this.activeTab === 'playlists') {
      currentKey = this.playlistSortKey;
      currentDirection = this.playlistSortDirection;
    } else if (this.activeTab === 'artists') {
      currentKey = this.artistSortKey;
      currentDirection = this.artistSortDirection;
    } else if (this.activeTab === 'albums') {
      currentKey = this.albumSortKey;
      currentDirection = this.albumSortDirection;
    }
    
    // If clicking the same key, toggle direction; otherwise, set new key and default to 'asc'
    let newDirection: SortDirection = 'asc';
    if (currentKey === key) {
      newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    }

    this.logger.log(`Setting sort for ${this.activeTab}: key=${key}, direction=${newDirection}`);

    // Update the correct state variables
    if (this.activeTab === 'playlists') {
      this.playlistSortKey = key as PlaylistSortKey;
      this.playlistSortDirection = newDirection;
    } else if (this.activeTab === 'artists') {
      this.artistSortKey = key as ArtistSortKey;
      this.artistSortDirection = newDirection;
    } else if (this.activeTab === 'albums') {
      this.albumSortKey = key as AlbumSortKey;
      this.albumSortDirection = newDirection;
    }

    // Re-apply filter and sort
    this.applyFilterAndSort();
  }

  /**
   * Sorting logic (operates on the passed array)
   */
  private sortData(items: any[]): void {
    let sortKey: string = '';
    let sortDirection: SortDirection = 'asc';

    // Get sort settings for the current tab
    if (this.activeTab === 'playlists') {
      sortKey = this.playlistSortKey;
      sortDirection = this.playlistSortDirection;
    } else if (this.activeTab === 'artists') {
      sortKey = this.artistSortKey;
      sortDirection = this.artistSortDirection;
    } else if (this.activeTab === 'albums') {
      sortKey = this.albumSortKey;
      sortDirection = this.albumSortDirection;
    } else {
      return; // Should not happen
    }

    const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

    items.sort((a, b) => {
      let valA: any;
      let valB: any;

      // Extract values based on activeTab and sortKey
      if (this.activeTab === 'playlists') {
        const pA = a as SpotifyPlaylist;
        const pB = b as SpotifyPlaylist;
        
        if (sortKey === 'name') {
          valA = pA.name?.toLowerCase();
          valB = pB.name?.toLowerCase();
        } else if (sortKey === 'owner') {
          valA = pA.owner?.display_name?.toLowerCase() || pA.owner?.id;
          valB = pB.owner?.display_name?.toLowerCase() || pB.owner?.id;
        } else if (sortKey === 'tracks') {
          valA = pA.tracks?.total ?? 0;
          valB = pB.tracks?.total ?? 0;
        }
      } else if (this.activeTab === 'artists') {
        const artA = a as SpotifyArtist;
        const artB = b as SpotifyArtist;
        
        if (sortKey === 'name') {
          valA = artA.name?.toLowerCase();
          valB = artB.name?.toLowerCase();
        } else if (sortKey === 'popularity') {
          valA = artA.popularity ?? -1;
          valB = artB.popularity ?? -1; // Use -1 for undefined
        } else if (sortKey === 'followers') {
          valA = artA.followers?.total ?? 0;
          valB = artB.followers?.total ?? 0;
        }
      } else if (this.activeTab === 'albums') {
        const itemA = a as SpotifySavedAlbumObject;
        const itemB = b as SpotifySavedAlbumObject;
        
        if (sortKey === 'albumName') {
          valA = itemA.album.name?.toLowerCase();
          valB = itemB.album.name?.toLowerCase();
        } else if (sortKey === 'artistName') {
          valA = itemA.album.artists?.[0]?.name?.toLowerCase();
          valB = itemB.album.artists?.[0]?.name?.toLowerCase(); // Sort by primary artist
        } else if (sortKey === 'releaseDate') {
          valA = itemA.album.release_date;
          valB = itemB.album.release_date;
        } else if (sortKey === 'popularity') {
          valA = itemA.album.popularity ?? -1;
          valB = itemB.album.popularity ?? -1;
        } else if (sortKey === 'addedDate') {
          valA = itemA.added_at;
          valB = itemB.added_at;
        }
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

  /**
   * Get concatenated artist names
   */
  getArtistNames(artists: SpotifyArtist[] | undefined): string {
    if (!artists || artists.length === 0) return 'Unknown Artist';
    return artists.map(a => a.name).join(', ');
  }

  /**
   * Handle image loading errors
   */
  handleImageError(event: Event): void {
    this.logger.warn('Image loading failed, using fallback');
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/no-image.jpg';
  }

  /**
   * Initiate Spotify login
   */
  login(): void {
    this.spotifyService.authorize('/library');
  }

  /**
   * Handle errors uniformly
   */
  private handleError(err: any, defaultMessage: string): void {
    this.logger.error(`Error: ${defaultMessage}`, err);
    const message = err?.message || defaultMessage;
    this.showFeedback('error', message, 7000);
  }
}