import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// Import from barrel file
import { 
  SpotifyService, 
  SpotifyTrack, 
  SpotifyArtist,
  LoggerService,
  TopItemsTimeRange 
} from '../../services';

/**
 * Component for displaying user's Spotify statistics
 * - Top tracks
 * - Top artists
 * - Recently played tracks
 */
@Component({
  selector: 'app-user-stats',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './user-stats.component.html',
  styleUrls: ['./user-stats.component.scss']
})
export class UserStatsComponent implements OnInit, OnDestroy {
  // Loading and error states
  loadingTopTracks: boolean = false;
  loadingTopArtists: boolean = false;
  loadingRecent: boolean = false;
  errorTopTracks: string | null = null;
  errorTopArtists: string | null = null;
  errorRecent: string | null = null;

  // Data containers
  topTracks: SpotifyTrack[] = [];
  topArtists: SpotifyArtist[] = [];
  recentTracks: any[] = []; // Will store PlayHistoryObject items { track: {...}, played_at: '...' }

  // User preferences
  selectedTimeRange: TopItemsTimeRange = 'medium_term';
  selectedLength: 10 | 50 = 10; // Default: Top 10
  
  isLoggedIn = false;
  
  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    public spotifyService: SpotifyService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state observable
    this.spotifyService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        if (this.isLoggedIn) {
          this.fetchAllStats();
        }
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Fetch all user statistics
   */
  fetchAllStats(): void {
    this.loadTopItems();
    this.loadRecentTracks();
  }

  /**
   * Load both top tracks and artists
   */
  loadTopItems(): void {
    this.loadTopTracks(this.selectedTimeRange, this.selectedLength);
    this.loadTopArtists(this.selectedTimeRange, this.selectedLength);
  }

  /**
   * Load user's top tracks
   * @param timeRange Time period to analyze
   * @param limit Number of tracks to retrieve
   */
  async loadTopTracks(timeRange: TopItemsTimeRange, limit: number): Promise<void> {
    this.loadingTopTracks = true;
    this.errorTopTracks = null;
    this.topTracks = []; // Clear previous results

    try {
      this.logger.log(`Loading top ${limit} tracks for time range: ${timeRange}`);
      const tracks = await this.spotifyService.getTopTracks(timeRange, limit);
      
      if (tracks && tracks.length > 0) {
        this.topTracks = tracks;
        this.logger.log(`Loaded ${tracks.length} top tracks`);
      } else {
        this.errorTopTracks = 'Could not load top tracks.';
        this.logger.warn('No top tracks returned from API');
      }
    } catch (error: any) {
      this.logger.error("Error loading top tracks:", error);
      this.errorTopTracks = error.message || 'Failed to load top tracks.';
    } finally {
      this.loadingTopTracks = false;
    }
  }  

  /**
   * Load user's top artists
   * @param timeRange Time period to analyze
   * @param limit Number of artists to retrieve
   */
  async loadTopArtists(timeRange: TopItemsTimeRange, limit: number): Promise<void> {
    this.loadingTopArtists = true;
    this.errorTopArtists = null;
    this.topArtists = []; // Clear previous results

    try {
      this.logger.log(`Loading top ${limit} artists for time range: ${timeRange}`);
      const artists = await this.spotifyService.getTopArtists(timeRange, limit);
      
      if (artists && artists.length > 0) {
        this.topArtists = artists;
        this.logger.log(`Loaded ${artists.length} top artists`);
      } else {
        this.errorTopArtists = 'Could not load top artists.';
        this.logger.warn('No top artists returned from API');
      }
    } catch (error: any) {
      this.logger.error("Error loading top artists:", error);
      this.errorTopArtists = error.message || 'Failed to load top artists.';
    } finally {
      this.loadingTopArtists = false;
    }
  }

  /**
   * Load user's recently played tracks
   */
  async loadRecentTracks(): Promise<void> {
    this.loadingRecent = true;
    this.errorRecent = null;
    this.recentTracks = []; // Clear previous results

    try {
      this.logger.log('Loading recently played tracks');
      const data = await this.spotifyService.getRecentlyPlayed(50);
      
      if (data && data.items) {
        this.recentTracks = data.items; // Items are PlayHistoryObjects
        this.logger.log(`Loaded ${data.items.length} recently played tracks`);
      } else {
        this.errorRecent = 'Could not load recently played tracks.';
        this.logger.warn('No recently played tracks returned from API');
      }
    } catch (error: any) {
      this.logger.error("Error loading recent tracks:", error);
      this.errorRecent = error.message || 'Failed to load recently played tracks.';
    } finally {
      this.loadingRecent = false;
    }
  }

  /**
   * Set the time range and reload top items
   */
  setTimeRange(range: TopItemsTimeRange): void {
    if (this.selectedTimeRange === range) return; // Do nothing if already selected
    
    this.selectedTimeRange = range;
    this.logger.log(`Time range set to: ${this.selectedTimeRange}`);
    this.loadTopItems(); // Reload top items with new range and current length
  }

  /**
   * Set the result length and reload top items
   */
  setLength(length: 10 | 50): void {
    if (this.selectedLength === length) return; // Do nothing if already selected
    
    this.selectedLength = length;
    this.logger.log(`Length set to: ${this.selectedLength}`);
    this.loadTopItems(); // Reload top items with current range and new length
  }

  /**
   * Helper function to get concatenated artist names
   */
  getArtistNames(artists: any[]): string {
    if (!artists || artists.length === 0) {
      return 'Unknown Artist'; // Handle cases with no artists
    }
    return artists.map(a => a.name).join(', ');
  }

  /**
   * Initiate Spotify login process
   */
  login(): void {    
    this.spotifyService.authorize('/stats'); 
  }

  /**
   * Handle image loading errors
   */
  handleImageError(event: Event): void {
    this.logger.warn('Image loading failed, using fallback');
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/no-image.jpg';
  }
}