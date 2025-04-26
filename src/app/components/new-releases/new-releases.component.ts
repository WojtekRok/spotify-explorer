// new-releases.component.ts (Updated for Spotify + Type Filtering)
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpotifyService } from '../../services/spotify.service'; // Use Spotify service again
import { finalize } from 'rxjs/operators'; // Keep finalize if using Observables, not needed for async/await

@Component({
  selector: 'app-new-releases',
  standalone: true,
  imports: [CommonModule, FormsModule], // Ensure CommonModule for *ngIf/*ngFor
  templateUrl: './new-releases.component.html',
  styleUrls: ['./new-releases.component.scss']
})
export class NewReleasesComponent implements OnInit {
  allNewReleases: any[] = []; // Store all fetched releases
  filteredNewReleases: any[] = []; // Store releases to display
  loading: boolean = false;
  error: string | null = null;
  isLoggedIn: boolean = false;

  // Filter state
  selectedAlbumType: 'all' | 'album' | 'single' | 'compilation' = 'all'; 

  constructor(public spotifyService: SpotifyService) {} // Inject SpotifyService

  ngOnInit(): void {
    this.isLoggedIn = this.spotifyService.isLoggedIn();
    if (this.isLoggedIn) {
      this.loadNewReleases();
    }
  }

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
      // Call the simplified Spotify service method
      const data = await this.spotifyService.getNewReleases(50); // Fetch 50 items

      if (data && data.albums && data.albums.items) {
        this.allNewReleases = data.albums.items;
        // Optional: Log types found for debugging
        const typesFound = new Set(this.allNewReleases.map(r => r.album_type));
        console.log("Album types found in this batch:", Array.from(typesFound));

        this.applyFilter(); // Apply the default filter initially
      } else {
        this.error = 'No new releases available or failed to parse response.';
      }
    } catch (error: any) {
      console.error('Error loading new releases:', error);
      this.error = error.message || 'Failed to load new releases';
    } finally {
      this.loading = false;
    }
  }

  // Function to apply the current filter
  applyFilter(): void {
    if (this.selectedAlbumType === 'all') {
      this.filteredNewReleases = [...this.allNewReleases];
    } else if (this.selectedAlbumType === 'album') {
      this.filteredNewReleases = this.allNewReleases.filter(
        release => release.album_type === 'album'
      );
    } else if (this.selectedAlbumType === 'single') { // Now includes 'ep'
      this.filteredNewReleases = this.allNewReleases.filter(
        release => release.album_type === 'single' || release.album_type === 'ep'
      );
    } else if (this.selectedAlbumType === 'compilation') {
      this.filteredNewReleases = this.allNewReleases.filter(
        release => release.album_type === 'compilation'
      );
    } else {
       // Should not happen, but default to all
       this.filteredNewReleases = [...this.allNewReleases];
    }
    console.log(`Filtered to show ${this.selectedAlbumType}: ${this.filteredNewReleases.length} items`);
  }

  // Method called when user clicks a filter button/tab
  setFilter(type: 'all' | 'album' | 'single' | 'compilation'): void {
    this.selectedAlbumType = type;
    this.applyFilter();
  }

  // Keep login/image error handlers
  login(): void {
    this.spotifyService.authorize('/new-releases');
  }

  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/no-image.jpg';
  }
}