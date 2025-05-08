import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MixGeneratorLoaderComponent } from './mix-generator-loader.component';

describe('MixGeneratorLoaderComponent', () => {
  let component: MixGeneratorLoaderComponent;
  let fixture: ComponentFixture<MixGeneratorLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MixGeneratorLoaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MixGeneratorLoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
