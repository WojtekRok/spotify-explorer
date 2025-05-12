import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Import from barrel file
import { SpotifyService, LoggerService } from '../../services';

/**
 * Navigation bar component with auth state display and logout functionality
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  userProfile: any = null;
  
  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private spotifyService: SpotifyService,
    private logger: LoggerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state
    this.spotifyService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        
        if (loggedIn) {
          this.loadUserProfile();
        } else {
          this.userProfile = null;
        }
      });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load user profile for display
   */
  private async loadUserProfile(): Promise<void> {
    try {
      this.userProfile = await this.spotifyService.getUserProfile();
      this.logger.log('User profile loaded for navbar');
    } catch (error) {
      this.logger.error('Error loading user profile:', error);
    }
  }

  /**
   * Initiate Spotify login
   */
  login(): void {
    this.logger.log('Initiating Spotify login from navbar');
    this.spotifyService.authorize();
  }
  
  /**
   * Logout from Spotify
   */
  logout(): void {
    this.logger.log('Logging out user');
    this.spotifyService.logout();
    this.router.navigate(['/']);
  }
}