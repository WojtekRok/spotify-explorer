import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Import from barrel file
import { SpotifyService, LoggerService } from '../../services';

// Define the filter types for the UI
type FilterType = 'all' | 'album' | 'single' | 'compilation';

// Define a more complete type for album_type (including 'ep' which Spotify API can return)
type SpotifyAlbumType = 'album' | 'single' | 'compilation' | 'ep' | string;

// Define our album interface with the updated type
interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: SpotifyAlbumType;
  artists: Array<{id: string; name: string}>;
  images: Array<{url: string; height: number; width: number}>;
  release_date: string;
  external_urls: {spotify?: string};
  [key: string]: any; // Allow for other properties
}

/**
 * Component for displaying Spotify's new releases with filtering options
 */
@Component({
  selector: 'app-new-releases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-releases.component.html',
  styleUrls: ['./new-releases.component.scss']
})
export class NewReleasesComponent implements OnInit, OnDestroy {
  // Data
  allNewReleases: SpotifyAlbum[] = [];      // Store all fetched releases
  filteredNewReleases: SpotifyAlbum[] = []; // Store releases to display after filtering
  
  // UI State
  loading = false;
  error: string | null = null;
  isLoggedIn = false;
  
  // Filter state
  selectedAlbumType: FilterType = 'all';
  
  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    public spotifyService: SpotifyService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.spotifyService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        if (this.isLoggedIn && this.allNewReleases.length === 0) {
          this.loadNewReleases();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load new releases from Spotify
   */
  async loadNewReleases(): Promise<void> {
    if (!this.isLoggedIn) {
      this.error = "Please log in with Spotify to see new releases.";
      return;
    }

    this.loading = true;
    this.error = null;
    this.allNewReleases = [];
    this.filteredNewReleases = [];

    try {
      this.logger.log("Loading new releases from Spotify");
      const data = await this.spotifyService.getNewReleases(50);

      if (data && data.albums && data.albums.items) {
        this.allNewReleases = data.albums.items;
        
        // Log found album types for debugging
        const typesFound = new Set(this.allNewReleases.map(r => r.album_type));
        this.logger.debug("Album types found:", Array.from(typesFound));

        this.applyFilter(); // Apply the default filter initially
        this.logger.log(`Loaded ${this.allNewReleases.length} new releases`);
      } else {
        this.error = 'No new releases available or failed to parse response.';
        this.logger.warn(this.error);
      }
    } catch (error: any) {
      this.logger.error('Error loading new releases:', error);
      this.error = error.message || 'Failed to load new releases';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Apply the current filter to the releases
   */
  applyFilter(): void {
    if (this.selectedAlbumType === 'all') {
      this.filteredNewReleases = [...this.allNewReleases];
    } else if (this.selectedAlbumType === 'album') {
      this.filteredNewReleases = this.allNewReleases.filter(
        release => release.album_type === 'album'
      );
    } else if (this.selectedAlbumType === 'single') {
      this.filteredNewReleases = this.allNewReleases.filter(
        release => release.album_type === 'single' || release.album_type === 'ep'
      );
    } else if (this.selectedAlbumType === 'compilation') {
      this.filteredNewReleases = this.allNewReleases.filter(
        release => release.album_type === 'compilation'
      );
    } else {
      // Default to all
      this.filteredNewReleases = [...this.allNewReleases];
    }
    
    this.logger.log(`Filtered to show ${this.selectedAlbumType}: ${this.filteredNewReleases.length} items`);
  }

  /**
   * Set the filter type and apply it
   */
  setFilter(type: FilterType): void {
    this.selectedAlbumType = type;
    this.applyFilter();
  }

  /**
   * Handle Spotify login
   */
  login(): void {
    this.spotifyService.authorize('/new-releases');
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
   * Reload the new releases data
   */
  refresh(): void {
    this.loadNewReleases();
  }
  
  /**
   * Get artist names as a string
   */
  getArtistNames(album: SpotifyAlbum): string {
    if (!album.artists || album.artists.length === 0) {
      return 'Unknown Artist';
    }
    return album.artists.map(artist => artist.name).join(', ');
  }
}