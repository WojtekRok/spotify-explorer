import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Import from barrel file
import { SpotifyService, LoggerService } from '../../services';

/**
 * Home component serving as the landing page for the application
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  
  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    public spotifyService: SpotifyService, // Made public for template access
    private logger: LoggerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.spotifyService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        this.logger.log(`Auth state changed: isLoggedIn = ${loggedIn}`);
      });
      
    // Debug: Initial state check
    this.logger.log(`Initial auth state: isLoggedIn = ${this.isLoggedIn}`);
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initiate Spotify login
   * Modified with additional debug information 
   */
  login(): void {
    // Debug - log before attempt
    console.log('Login button clicked! Attempting to start Spotify auth...');
    this.logger.log('Initiating Spotify login from Home page');
    
    try {
      // Call the service authorize method
      this.spotifyService.authorize('/');
      console.log('Spotify authorize method called successfully');
    } catch (error) {
      console.error('Error when calling authorize method:', error);
      this.logger.error('Error in login function:', error);
    }
  }

  /**
   * Navigate to the mix generator
   */
  openMixGenerator(): void {
    this.logger.log('Navigating to mix generator');
    this.router.navigate(['/mix-generator']);
  }
}