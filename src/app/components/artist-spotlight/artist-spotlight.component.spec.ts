import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArtistSpotlightComponent } from './artist-spotlight.component';

describe('ArtistSpotlightComponent', () => {
  let component: ArtistSpotlightComponent;
  let fixture: ComponentFixture<ArtistSpotlightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArtistSpotlightComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArtistSpotlightComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
