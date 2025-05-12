import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Import from barrel file
import { SpotifyService, LoggerService } from '../../services';

/**
 * Component for searching Spotify artists, albums, and tracks
 */
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  // Search state
  searchQuery = '';
  searchType: 'artist' | 'album' | 'track' | 'playlist' = 'artist';
  searchResults: any[] = [];
  loading = false;
  searched = false;
  isLoggedIn = false;
  error: string | null = null;
  
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
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Perform search against Spotify API
   */
  async search(): Promise<void> {
    // Validate input
    if (this.searchQuery.trim() === '') {
      return;
    }

    this.loading = true;
    this.searched = true;
    this.error = null;
    
    this.logger.log(`Searching for ${this.searchType}: "${this.searchQuery}"`);
    
    try {
      const res = await this.spotifyService.search(this.searchQuery, this.searchType);
      
      // Extract the appropriate results based on type
      const key = `${this.searchType}s`; // artists, albums, or tracks
      this.searchResults = res[key]?.items || [];
      
      this.logger.log(`Found ${this.searchResults.length} ${key}`);
      
      if (this.searchResults.length === 0) {
        this.error = `No ${this.searchType}s found matching "${this.searchQuery}"`;
      }
    } catch (error: any) {
      this.logger.error('Search error:', error);
      this.error = error?.message || `Error searching for ${this.searchType}s`;
      this.searchResults = [];
    } finally {
      this.loading = false;
    }
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
    this.spotifyService.authorize('/search');
  }
  
  /**
   * Clear search results and error
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.searched = false;
    this.error = null;
  }
  
  /**
   * Get formatted display name for each result type
   */
  getDisplayName(item: any): string {
    switch (this.searchType) {
      case 'artist':
        return item.name || 'Unknown Artist';
      case 'album':
        const artists = item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
        return `${item.name || 'Unknown Album'} by ${artists}`;
      case 'track':
        const trackArtists = item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
        const album = item.album?.name ? ` from ${item.album.name}` : '';
        return `${item.name || 'Unknown Track'} by ${trackArtists}${album}`;
      case 'playlist':
        const owner = item.owner?.display_name || item.owner?.id || 'Unknown User';
        return `${item.name || 'Unknown Playlist'} by ${owner}`;
      default:
        return item.name || 'Unknown';
    }
  }
  
  /**
   * Get the appropriate image for a result
   */
  getImageUrl(item: any): string {
    // Different result types have images in different places
    if (this.searchType === 'track' && item.album?.images) {
      return item.album.images[1]?.url || item.album.images[0]?.url || 'assets/no-image.jpg';
    } else if (item.images) {
      return item.images[1]?.url || item.images[0]?.url || 'assets/no-image.jpg';
    }
    return 'assets/no-image.jpg';
  }
}