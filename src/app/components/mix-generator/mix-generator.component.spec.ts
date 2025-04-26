import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MixGeneratorComponent } from './mix-generator.component';

describe('MixGeneratorComponent', () => {
  let component: MixGeneratorComponent;
  let fixture: ComponentFixture<MixGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MixGeneratorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MixGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
