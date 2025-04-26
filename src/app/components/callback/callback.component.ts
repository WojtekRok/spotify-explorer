import { Component, OnInit } from '@angular/core';
import { SpotifyService } from '../../services/spotify.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.scss'
})
export class CallbackComponent implements OnInit {
  constructor(private spotifyService: SpotifyService, private router: Router) {}
  async ngOnInit(): Promise<void>  {
    try {
      const success = await this.spotifyService.handleCallback();

      if (success) {
        console.log('Spotify callback handled successfully.');
        // --- START: Redirect Logic ---
        const returnPath = localStorage.getItem('spotify_auth_return_path');
        localStorage.removeItem('spotify_auth_return_path'); // Clean up immediately

        // Navigate to the stored path, or fallback to home/search
        const navigateTo = returnPath || '/'; // Fallback to home page
        console.log(`Callback success, navigating to: ${navigateTo}`);
        this.router.navigateByUrl(navigateTo); 
        // --- END: Redirect Logic ---
      } else {
        console.error('Spotify callback handling failed.');
        // Redirect to an error page or home with an error message?
        this.router.navigate(['/']); 
      }
    } catch (error) {
      console.error('Error during Spotify callback handling:', error);
      this.router.navigate(['/']); // Redirect on error
    }
  }
}


