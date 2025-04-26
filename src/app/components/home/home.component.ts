import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SpotifyService } from '../../services/spotify.service';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  isLoggedIn: boolean = false;

  constructor(
    private spotifyService: SpotifyService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.spotifyService.isLoggedIn();
  }

  login(): void {
    this.spotifyService.authorize();
  }

  openMixGenerator(): void {
    // For now, we'll just navigate to a placeholder route
    // Later we'll implement the modal functionality
    this.router.navigate(['/mix-generator']);
  }
}
