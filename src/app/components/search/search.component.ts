import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpotifyService } from '../../services/spotify.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  searchQuery: string = '';
  searchType: string = 'artist';
  searchResults: any[] = [];
  loading: boolean = false;
  searched: boolean = false;

  constructor(public spotifyService: SpotifyService) { }

  async search(): Promise<void> {
    if (this.searchQuery.trim() === '') {
      return;
    }

    this.loading = true;
    this.searched = true;
    
    try {
      const res = await this.spotifyService.search(this.searchQuery, this.searchType);
      
      if (res.error) {
        // Handle error - e.g., need to login again
        this.searchResults = [];
      } else {
        // Extract the appropriate results based on type
        const key = `${this.searchType}s`; // artists, albums, or tracks
        this.searchResults = res[key]?.items || [];
      }
    } catch (error) {
      console.error('Search error:', error);
      this.searchResults = [];
    } finally {
      this.loading = false;
    }
  }
  handleImageError(event: any): void {
    event.target.src = 'assets/no-image.jpg';
  }
  login(): void {
    this.spotifyService.authorize();
  }
}