import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class FilesService {
  private files$ = new BehaviorSubject<File[]>([]);
  files = this.files$.asObservable();

  setFiles(files: File[]) {
    this.files$.next(files);
  }
}
