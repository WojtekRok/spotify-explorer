import { TestBed } from '@angular/core/testing';

import { SpotifyBrowseService } from './spotify-browse.service';

describe('SpotifyBrowseService', () => {
  let service: SpotifyBrowseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SpotifyBrowseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
