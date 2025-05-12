import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SpotifyAuthService } from '../../services/spotify-auth.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss']
})
export class CallbackComponent implements OnInit {
  loading = true;
  error = false;
  errorMessage = '';
  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    public authService: SpotifyAuthService,
    private router: Router,
    private logger: LoggerService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async ngOnInit(): Promise<void> {
    // Skip processing during server-side rendering
    if (!this.isBrowser) {
      this.logger.log('Callback: Skipping processing in SSR mode');
      return;
    }
    
    try {
      this.logger.log('Callback component initialized, processing auth callback...');
      
      // Short delay to ensure the component is fully rendered
      // This helps avoid the brief error flash
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Handle the OAuth callback
      const success = await this.authService.handleCallback();

      if (success) {
        this.logger.log('Spotify callback handled successfully');
        
        // Get the return path and clean up
        const returnPath = localStorage.getItem('spotify_auth_return_path') || '/';
        localStorage.removeItem('spotify_auth_return_path');
        
        // Ensure we have a valid token before proceeding
        const validToken = await this.authService.ensureValidToken();
        
        if (validToken) {
          this.logger.log(`Valid token confirmed, navigating to: ${returnPath}`);
          this.router.navigateByUrl(returnPath);
        } else {
          this.handleError('Failed to obtain a valid token');
        }
      } else {
        this.handleError('Authentication failed');
      }
    } catch (error: any) {
      this.handleError(`Error during callback: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Handle authentication errors
   */
  private handleError(message: string): void {
    this.logger.error('Authentication error:', message);
    this.loading = false;
    this.error = true;
    this.errorMessage = message;
  }
}