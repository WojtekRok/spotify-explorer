import { TestBed } from '@angular/core/testing';

import { SpotifyUserService } from './spotify-user.service';

describe('SpotifyUserService', () => {
  let service: SpotifyUserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SpotifyUserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
