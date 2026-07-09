import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileDropzoneComponent } from './file-dropzone.component';
import { FilesService } from '../../services/files.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('FileDropzoneComponent', () => {
  let component: FileDropzoneComponent;
  let fixture: ComponentFixture<FileDropzoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileDropzoneComponent],
      providers: [FilesService],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(FileDropzoneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
