import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Service that stores all uploaded files currently visible in the dropzone
 */
@Injectable()
export class FilesService {
  private files$ = new BehaviorSubject<File[]>([]);
  files = this.files$.asObservable();

  setFiles(files: File[]) {
    this.files$.next(files);
  }
}
