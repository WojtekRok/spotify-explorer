// src/app/features/user-stats/user-stats.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import CommonModule and DatePipe
import { SpotifyService } from '../../services/spotify.service'; // Adjust path if needed

// Define types for time range for better type safety
type TimeRange = 'short_term' | 'medium_term' | 'long_term';

@Component({
  selector: 'app-user-stats',
  standalone: true,
  // Import necessary modules for the template
  imports: [CommonModule, DatePipe], 
  templateUrl: './user-stats.component.html',
  styleUrls: ['./user-stats.component.scss']
})
export class UserStatsComponent implements OnInit {

  // State Variables
  loadingTopTracks: boolean = false;
  loadingTopArtists: boolean = false;
  loadingRecent: boolean = false;
  errorTopTracks: string | null = null;
  errorTopArtists: string | null = null;
  errorRecent: string | null = null;

  topTracks: any[] = [];
  topArtists: any[] = [];
  recentTracks: any[] = []; // Will store PlayHistoryObject items { track: {...}, played_at: '...' }

  // Default time range for top items
  selectedTimeRange: TimeRange = 'medium_term'; 
  selectedLength: 10 | 50 = 10; // Default: Top 10
  
  isLoggedIn: boolean = false;

  constructor(public spotifyService: SpotifyService) {} // Make public if accessed in template

  ngOnInit(): void {
    this.isLoggedIn = this.spotifyService.isLoggedIn();
    if (this.isLoggedIn) {
      this.fetchAllStats(); // Fetch all data on initial load
    }
  }
  
  // --- Data Fetching Methods ---

  fetchAllStats(): void {
    this.loadTopItems();
    this.loadRecentTracks();
  }

  loadTopItems(): void {
     this.loadTopTracks(this.selectedTimeRange, this.selectedLength);
     this.loadTopArtists(this.selectedTimeRange, this.selectedLength);
  }

  async loadTopTracks(timeRange: TimeRange, limit: number): Promise<void> {
    this.loadingTopTracks = true;
    this.errorTopTracks = null;
    this.topTracks = []; // Clear previous results

    try {
      const data = await this.spotifyService.getTopItems('tracks', timeRange, limit);
      if (data && data.items) {
        this.topTracks = data.items;
      } else {
         this.errorTopTracks = 'Could not load top tracks.';
      }
    } catch (error: any) {
      console.error("Error loading top tracks:", error);
      this.errorTopTracks = error.message || 'Failed to load top tracks.';
    } finally {
      this.loadingTopTracks = false;
    }
  }  

  async loadTopArtists(timeRange: TimeRange, limit: number): Promise<void> {
    this.loadingTopArtists = true;
    this.errorTopArtists = null;
    this.topArtists = []; // Clear previous results

    try {
      const data = await this.spotifyService.getTopItems('artists', timeRange, limit); // Fetch up to 50
      if (data && data.items) {
        this.topArtists = data.items;
      } else {
         this.errorTopArtists = 'Could not load top artists.';
      }
    } catch (error: any) {
      console.error("Error loading top artists:", error);
      this.errorTopArtists = error.message || 'Failed to load top artists.';
    } finally {
      this.loadingTopArtists = false;
    }
  }

  async loadRecentTracks(): Promise<void> {
    this.loadingRecent = true;
    this.errorRecent = null;
    this.recentTracks = []; // Clear previous results

    try {
      const data = await this.spotifyService.getRecentlyPlayed(50); // Fetch up to 50
      if (data && data.items) {
        this.recentTracks = data.items; // Items are PlayHistoryObjects
      } else {
         this.errorRecent = 'Could not load recently played tracks.';
      }
    } catch (error: any) {
      console.error("Error loading recent tracks:", error);
      this.errorRecent = error.message || 'Failed to load recently played tracks.';
    } finally {
      this.loadingRecent = false;
    }
  }

  // --- Event Handlers ---

  // Set the time range and reload top items
  setTimeRange(range: TimeRange): void {
    if (this.selectedTimeRange === range) return; // Do nothing if already selected
    this.selectedTimeRange = range;
    console.log(`Time range set to: ${this.selectedTimeRange}`);
    this.loadTopItems(); // Reload top items with new range and current length
  }

  // Set the length and reload top items
  setLength(length: 10 | 50): void {
     if (this.selectedLength === length) return; // Do nothing if already selected
    this.selectedLength = length;
    console.log(`Length set to: ${this.selectedLength}`);
    this.loadTopItems(); // Reload top items with current range and new length
  }
  // Helper function to get concatenated artist names
  getArtistNames(artists: any[]): string {
    if (!artists || artists.length === 0) {
        return 'Unknown Artist'; // Handle cases with no artists
  }
    return artists.map(a => a.name).join(', ');
  }

  login(): void {
    // Redirect back to this page after login
    this.spotifyService.authorize('/user-stats'); 
  }

   handleImageError(event: Event): void {
     const imgElement = event.target as HTMLImageElement;
     imgElement.src = 'assets/no-image.jpg'; // Your fallback image path
   }
}