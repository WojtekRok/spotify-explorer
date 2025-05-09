import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { SourceMode } from '../mix-generator/mix-generator.component';

@Component({
  selector: 'app-mix-generator-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mix-generator-loader.component.html',
  styleUrls: ['./mix-generator-loader.component.scss']
})
export class MixGeneratorLoaderComponent implements OnInit, OnDestroy {
  @Input() sourceMode: SourceMode = 'mix';
  
  progress = 0;
  currentImageIndex = 0;
  currentImagePath = '';
  previousImagePath = '';
  isTransitioning = false;
  isPulsating = false;
  pulsationIntensity = 1; // Starting intensity of pulsation (1-5)
  progressInterval: any;
  imageInterval: any;
  factInterval: any;
  finalProgressInterval: any;
  pulsationInterval: any;
  isInFinalPhase = false;
  
  // Images are already labeled, so we only need the image count
  readonly TOTAL_IMAGES = 8;
  readonly FINAL_IMAGE_INDEX = 7; // 0-based index for the 8th image
  
  // Fun facts array
  musicFacts = [
    "Did you know? The Spotify logo green color is officially called 'Spotify Green' (RGB: 30, 215, 96).",
    "Fun fact: The average song length on Spotify is around 3 minutes and 30 seconds.",
    "Music tip: Studies show that listening to music can reduce anxiety by up to 65%.",
    "Spotify fact: The most streamed song of all time on Spotify is 'Shape of You' by Ed Sheeran.",
    "Music history: The first music streaming service was launched in 1993!"
  ];
  
  currentFact = '';
  showFact = false;
  
  ngOnInit() {
    // Initialize the first image
    this.currentImagePath = this.getImagePath(0);
    
    // Different speeds based on source mode
    const DURATION_CONFIG = {
      // For each mode, define the time to reach specific progress milestones (in ms)
      'followedOnly': {
        25: 5000,    // 5 seconds to reach 25%
        50: 15000,   // 15 seconds to reach 50%
        75: 25000,   // 25 seconds to reach 75% 
        90: 35000,   // 35 seconds to reach 90%
        95: 40000    // 40 seconds to reach 95% (max realistic time for followedOnly)
      },
      'playlistsOnly': {
        25: 3000,    // 3 seconds to reach 25%
        50: 8000,    // 8 seconds to reach 50%
        75: 15000,   // 15 seconds to reach 75%
        90: 18000,   // 18 seconds to reach 90%
        95: 20000    // 20 seconds to reach 95% (max realistic time for playlistsOnly)
      },
      'mix': {
        25: 4000,    // 4 seconds to reach 25%
        50: 10000,   // 10 seconds to reach 50%
        75: 20000,   // 20 seconds to reach 75%
        90: 25000,   // 25 seconds to reach 90%
        95: 30000    // 30 seconds to reach 95% (max realistic time for mix)
      },
      'customSelection': {
        25: 6000,    // 6 seconds to reach 25%
        50: 12000,   // 12 seconds to reach 50%
        75: 22000,   // 22 seconds to reach 75%
        90: 28000,   // 28 seconds to reach 90%
        95: 32000    // 32 seconds to reach 95% (max realistic time for customSelection)
      }
    };
    
    // Get config for current mode (or default to mix)
    const durationConfig = DURATION_CONFIG[this.sourceMode] || DURATION_CONFIG['mix'];
    const startTime = Date.now();
    
    // Start the progress simulation
    this.progressInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      
      // Determine progress based on elapsed time and the mode config
      if (elapsedTime < durationConfig[25]) {
        // Phase 1: 0-25%
        this.progress = Math.round((elapsedTime / durationConfig[25]) * 25);
      } else if (elapsedTime < durationConfig[50]) {
        // Phase 2: 25-50%
        this.progress = 25 + Math.round(((elapsedTime - durationConfig[25]) / (durationConfig[50] - durationConfig[25])) * 25);
      } else if (elapsedTime < durationConfig[75]) {
        // Phase 3: 50-75%
        this.progress = 50 + Math.round(((elapsedTime - durationConfig[50]) / (durationConfig[75] - durationConfig[50])) * 25);
      } else if (elapsedTime < durationConfig[90]) {
        // Phase 4: 75-90%
        this.progress = 75 + Math.round(((elapsedTime - durationConfig[75]) / (durationConfig[90] - durationConfig[75])) * 15);
      } else if (elapsedTime < durationConfig[95]) {
        // Phase 5: 90-95% (slow final phase)
        this.progress = 90 + Math.round(((elapsedTime - durationConfig[90]) / (durationConfig[95] - durationConfig[90])) * 5);
      } else if (!this.isInFinalPhase) {
        // We've reached 95% - now transition to the ultra-slow final phase
        this.progress = 95;
        this.isInFinalPhase = true;
        
        // Clear the main progress interval
        clearInterval(this.progressInterval);
        
        // Switch to the final image (cooking-8.png) if not already there
        if (this.currentImageIndex !== this.FINAL_IMAGE_INDEX) {
          // Force a direct change without animation to final image
          this.currentImageIndex = this.FINAL_IMAGE_INDEX;
          this.currentImagePath = this.getImagePath(this.FINAL_IMAGE_INDEX);
        }
        
        // Clear the image rotation interval since we want to stay on the final image
        if (this.imageInterval) {
          clearInterval(this.imageInterval);
          this.imageInterval = null;
        }
        
        // Start pulsating the final image
        this.isPulsating = true;
        this.startPulsatingAnimation();
        
        // Start the final super-slow crawl from 95% to 100%
        this.startFinalProgressPhase();
      }
    }, 250); // Update 4 times per second
    
    // Set up image rotation - show a new image every 5 seconds
    this.imageInterval = setInterval(() => {
      this.changeImage();
    }, 5000); // Change image every 5 seconds
    
    // Show facts at specific progress points
    this.factInterval = setInterval(() => {
      // Only show facts at 25%, 50%, and 75% progress
      if (
        (this.progress >= 25 && this.progress < 30 && !this.showFact) || 
        (this.progress >= 50 && this.progress < 55 && !this.showFact) || 
        (this.progress >= 75 && this.progress < 80 && !this.showFact) ||
        (this.progress >= 95 && this.progress < 96 && !this.showFact) // Extra fact at 95%
      ) {
        const factIndex = Math.floor(this.progress / 25) % this.musicFacts.length;
        this.currentFact = this.musicFacts[factIndex];
        this.showFact = true;
        
        // Hide the fact after 10 seconds
        setTimeout(() => {
          this.showFact = false;
        }, 10000);
      }
    }, 1000);
  }
  
  // Start the pulsation animation for the final image
  startPulsatingAnimation() {
    let pulsationStep = 0;
    
    this.pulsationInterval = setInterval(() => {
      pulsationStep = (pulsationStep + 1) % 10; // 0-9 repeating cycle
      
      // Every 8 steps, increase the pulsation intensity if we haven't reached max
      if (pulsationStep % 8 === 0 && this.pulsationIntensity < 5) {
        this.pulsationIntensity++;
        console.log(`Increased pulsation intensity to ${this.pulsationIntensity}`);
      }
      
    }, 2000); // Update every 2 seconds (same as progress updates)
  }
  
  // Separate method to handle the final progress phase from 95% to 99.99%
  startFinalProgressPhase() {
    let currentValue = 95;
    const increment = 0.25; // Increment by 0.25% per step
    const intervalTime = 2000; // Each step takes 2 seconds
    
    this.finalProgressInterval = setInterval(() => {
      currentValue += increment;
      this.progress = currentValue;
      
      // Log to ensure values are changing
      console.log(`Progress updated to: ${this.progress.toFixed(2)}%`);
      
      // Stop at 99.99%
      if (currentValue >= 99.99) {
        this.progress = 99.99;
        clearInterval(this.finalProgressInterval);
      }
    }, intervalTime);
  }
  
  // Get the path to an image by index
  getImagePath(index: number): string {
    return `assets/load/load_${index + 1}.png`;
  }
  
  // Change to the next image with animation
  changeImage() {
    // Don't change if already transitioning or if we're in final phase
    if (this.isTransitioning || this.isInFinalPhase) return;
    
    this.isTransitioning = true;
    this.previousImagePath = this.currentImagePath;
    
    // Move to next image in sequence
    this.currentImageIndex = (this.currentImageIndex + 1) % this.TOTAL_IMAGES;
    this.currentImagePath = this.getImagePath(this.currentImageIndex);
    
    // After animation completes, reset transition state
    setTimeout(() => {
      this.isTransitioning = false;
    }, 500); // Match this to the CSS transition duration
  }
  
  ngOnDestroy() {
    // Clean up intervals when component is destroyed
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.imageInterval) {
      clearInterval(this.imageInterval);
    }
    if (this.factInterval) {
      clearInterval(this.factInterval);
    }
    if (this.finalProgressInterval) {
      clearInterval(this.finalProgressInterval);
    }
    if (this.pulsationInterval) {
      clearInterval(this.pulsationInterval);
    }
  }
}