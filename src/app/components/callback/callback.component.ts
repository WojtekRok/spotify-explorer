import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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

  constructor(
    private authService: SpotifyAuthService,
    private router: Router,
    private logger: LoggerService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.logger.log('Callback component initialized, processing auth callback...');
      
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