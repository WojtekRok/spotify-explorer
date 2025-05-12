import { TestBed } from '@angular/core/testing';

import { SpotifyLibraryService } from './spotify-library.service';

describe('SpotifyLibraryService', () => {
  let service: SpotifyLibraryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SpotifyLibraryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
