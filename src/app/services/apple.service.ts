// src/app/services/apple.service.ts
import { Injectable } from '@angular/core';
import { Track }      from '../models/track.model';

const BASE = 'https://rss.applemarketingtools.com/api/v2';
// Using AllOrigins proxy as requested
const PROXY_BASE = 'https://api.allorigins.win/get?url=';
const FIXED_LIMIT = 50; // Hardcoded limit as requested

@Injectable({ providedIn: 'root' })
export class AppleService {

  // Using the fetch logic compatible with AllOrigins
  private async fetchAndParse(url: string): Promise<Track[]> {
    const proxyUrl = PROXY_BASE + encodeURIComponent(url);
    console.log('Fetching via proxy:', proxyUrl);
    console.log('Target URL:', url);

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.error(`Proxy fetch failed for ${url}: ${response.status} ${response.statusText}`);
        return [];
      }

      const outer = await response.json();

      if (!outer?.contents?.trim()) {
        console.warn(`No contents received from proxy for ${url}`);
        return [];
      }

      let feed: any;
      try {
        feed = JSON.parse(outer.contents);
      } catch (e) {
        console.error(`Failed to parse JSON contents for ${url}:`, outer.contents, e);
        return [];
      }

      if (feed.status && feed.status !== 200) {
        console.warn(`Apple API returned error status ${feed.status} for ${url}:`, feed.error || 'Unknown error');
        return [];
      }
      if (!feed?.feed?.results) {
         console.warn(`Feed or results missing in response for ${url}:`, feed);
         return [];
      }

      const list = feed.feed.results;
      return list.map((t: any, i: number): Track => ({
        position: i + 1,
        title: t.name,
        artist: t.artistName,
        thumbnail: (t.artworkUrl100 ?? '').replace('/100x100bb.jpg', '/60x60bb.jpg'),
        url: t.url
      }));

    } catch (error) {
      console.error(`Error during fetch or processing for ${url}:`, error);
      return [];
    }
  }

  // Simplified getTracks - no genre, fixed limit/path
  getTracks(cc: string): Promise<Track[]> {
    // Path based on RSS Generator: 'Most Played' feed for 'Songs' type
    const route = `music/most-played/${FIXED_LIMIT}/songs`;
    const fullUrl = `${BASE}/${cc}/${route}.json`;
    return this.fetchAndParse(fullUrl);
  }

  // Simplified getAlbums - fixed limit/path
  getAlbums(cc: string): Promise<Track[]> {
    // Path based on RSS Generator: 'Most Played' feed for 'Albums' type
    const route = `music/most-played/${FIXED_LIMIT}/albums`;
    const fullUrl = `${BASE}/${cc}/${route}.json`;
    return this.fetchAndParse(fullUrl);
  }
}