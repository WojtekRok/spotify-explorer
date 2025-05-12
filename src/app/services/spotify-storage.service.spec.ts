import { TestBed } from '@angular/core/testing';

import { SpotifyStorageService } from './spotify-storage.service';

describe('SpotifyStorageService', () => {
  let service: SpotifyStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SpotifyStorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
