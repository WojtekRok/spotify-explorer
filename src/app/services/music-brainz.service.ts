// musicbrainz.service.ts (New or add to existing service)
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // Use HttpClient for easier header/JSON handling
import { Observable, throwError } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MusicbrainzService {
  private baseUrl = 'https://musicbrainz.org/ws/2';
  // IMPORTANT: Replace with your actual app info
  private userAgent = 'MusicExplorer/0.1.0 ( woroztoro@gmail.com )'; 

  constructor(private http: HttpClient) {}

  // Function to get releases for a specific country in the last N days
  getNewReleases(countryCode: string, daysAgo: number = 90, limit: number = 50): Observable<any> {
    
    // --- Date Calculation ---
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysAgo);

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0]; 
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    // --- End Date Calculation ---

    // --- Query Construction ---
    let query = '';
    // Use 'firstreleasedate' field for filtering based on the release group's initial release
    const dateQueryPart = `date:[${startDateStr} TO ${endDateStr}]`; 
    const statusQueryPart = `status:official`; // Filter for official releases

    // Check if a specific country (and not 'GLOBAL' or empty) is requested
    if (countryCode && countryCode.toUpperCase() !== 'GLOBAL' && countryCode !== '') {
      // Build query including the country code
      query = `country:${countryCode} AND ${dateQueryPart} AND ${statusQueryPart}`;
      console.log(`Querying MusicBrainz for country: ${countryCode}`);
    } else {
      // Build query for Global releases (omit country filter)
      query = `${dateQueryPart} AND ${statusQueryPart}`;
      console.log(`Querying MusicBrainz for Global releases`);
    }
    
    // URL-encode the final query string
    const encodedQuery = encodeURIComponent(query);
    // --- End Query Construction ---

    // --- URL and Headers ---
    // Construct the full request URL
    const url = `${this.baseUrl}/release?query=${encodedQuery}&fmt=json&limit=${limit}&inc=artist-credits+release-groups`;

    // Set required headers (User-Agent will be blocked by browser but is good practice)
    const headers = new HttpHeaders({
      'User-Agent': this.userAgent, 
      'Accept': 'application/json' // Explicitly request JSON
    });
    // --- End URL and Headers ---

    console.log(`MusicBrainz Request URL: ${url}`); // Log the URL for debugging

    // --- HTTP Request with Delay and Error Handling ---
    return this.http.get<any>(url, { headers }).pipe(
      // Add delay to respect MusicBrainz 1 req/sec rate limit
      delay(1100), 
      map(response => {
        // Log how many results were received vs total found by MB
        const receivedCount = response?.releases?.length || 0;
        const totalCount = response?.count || 0; // Total matches found by MB
        console.log(`Received ${receivedCount} of ~${totalCount} releases from MusicBrainz for ${countryCode || 'Global'}`);
        return response; // Pass the full response object along
      }),
      catchError(error => {
        // Handle potential HTTP errors
        console.error('Error fetching from MusicBrainz:', error);
        let errorMsg = 'Failed to fetch data from MusicBrainz API. ';
        if (error.status === 400) {
            errorMsg += 'Bad Request (check query syntax).';
        } else if (error.status === 503) {
            // This is important for rate limiting
            errorMsg += 'Service Unavailable (likely rate limited). Please wait before trying again.';
        } else {
            errorMsg += `Status: ${error.status}.`;
        }
        // Return an observable error to be caught by the component
        return throwError(() => new Error(errorMsg)); 
      })
    );
    // --- End HTTP Request ---
  } // --- End of getNewReleases function ---


  // --- Helper to potentially get cover art (separate step, more complex) ---
  // This uses coverartarchive.org, which partners with MusicBrainz
  getCoverArtUrl(releaseMbId: string): Observable<string | null> {
     const coverArtUrl = `https://coverartarchive.org/release/${releaseMbId}`;
     // IMPORTANT: Cover Art Archive also has usage policies/rate limits!
     // Be careful making too many requests here.
     // Consider fetching only when needed (e.g., user clicks) or caching.

     // Use { observe: 'response', responseType: 'json' } to handle potential 404s gracefully
     return this.http.get<any>(coverArtUrl, { observe: 'response', responseType: 'json'}).pipe(
         delay(1100), // Also rate limit this if calling frequently
         map(response => {
             if (response.status === 200 && response.body?.images?.length > 0) {
                 // Prefer 'Front' image, otherwise take the first one
                 const frontImage = response.body.images.find((img: any) => img.front);
                 const imageUrl = frontImage?.thumbnails?.large || response.body.images[0]?.thumbnails?.large;
                 // You might want smaller thumbnails (e.g., .small) depending on usage
                 return imageUrl || null;
             }
             return null; // No images found or other issue
         }),
         catchError(error => {
             if (error.status === 404) {
                 console.log(`No cover art found for release ${releaseMbId}`);
                 return [null]; // Return null observable on 404
             }
             console.error(`Error fetching cover art for ${releaseMbId}:`, error);
             return [null]; // Return null observable on other errors
         })
     );
  }
}