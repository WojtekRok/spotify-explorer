// src/app/components/top-charts/top-charts.component.ts
import { Component, OnInit } from '@angular/core'; // Import OnInit
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { AppleService } from '../../services/apple.service';
import { Track } from '../../models/track.model';


@Component({
  standalone:true,
  selector:'app-top-charts',
  imports:[CommonModule,FormsModule],
  templateUrl:'./top-charts.component.html',
  styleUrls :['./top-charts.component.scss']
})
export class TopChartsComponent implements OnInit { // Implement OnInit

  // ───────────────────── dropdown data
  region   = 'us';           // Default to 'us'
  regions = [
    { code: 'us', name: 'USA' },
    { code: 'pl', name: 'Poland' },
    { code: 'de', name: 'Germany' },
    { code: 'gb', name: 'United Kingdom' },
    { code: 'au', name: 'Australia' },
    { code: 'ca', name: 'Canada' },
    { code: 'fr', name: 'France' },
    { code: 'is', name: 'Iceland' },
    { code: 'it', name: 'Italy' },
    { code: 'nl', name: 'Netherlands' },
    { code: 'es', name: 'Spain' },
    { code: 'se', name: 'Sweden' }
  ];

  get selectedRegionName(): string {
    const selected = this.regions.find(r => r.code === this.region);
    return selected ? selected.name : this.region.toUpperCase(); // Return name or code as fallback
  }

  // ───────────────────── chart holders
  singles : Track[] = [];
  albums  : Track[] = [];
  loading = true;

  constructor(private apple: AppleService){}

  // Use OnInit for initial load
  ngOnInit(){
    this.refresh();
  }

  // Handler for region change
  onRegionChange(){
    this.refresh();
  }

  // GENRE HANDLER REMOVED
  // onGenreChange() { this.refresh(); }

  // Simplified data loader
  async refresh() {
    this.loading = true;

    // No need to map 'global' anymore
    const cc = this.region;
    // Genre ID removed
    // const gid = this.genreId || undefined;

    console.log(`Refreshing charts for region: ${cc}`);

    try {
        [this.singles, this.albums] = await Promise.all([
          // Call simplified service methods (no genre id)
          this.apple.getTracks(cc),
          this.apple.getAlbums(cc)
        ]);
        console.log(`Fetched ${this.singles.length} singles and ${this.albums.length} albums.`);
    } catch (error) {
        console.error("Error during refresh:", error);
        // Optionally reset arrays or show an error message
        this.singles = [];
        this.albums = [];
    } finally {
        this.loading = false;
    }
  }

  /**
   * Generates a Spotify search URL for a given track/album.
   * @param item - The Track object containing title and artist.
   * @returns A URL string for Spotify search.
   */
  getSpotifySearchUrl(item: Track): string {
    // Construct a search query using title and artist for better accuracy
    const query = `${item.title} ${item.artist}`;
    // URL-encode the query string
    const encodedQuery = encodeURIComponent(query);
    // Return the full Spotify search URL
    return `https://open.spotify.com/search/${encodedQuery}`;
  }

  // helper used in template
  nicify(s:string){ return s.charAt(0).toUpperCase()+s.slice(1); }
  handleImgErr(e: Event) {
    (e.target as HTMLImageElement).src = 'assets/no-image.jpg';
  }
}