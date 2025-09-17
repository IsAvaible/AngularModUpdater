import { Component, OnDestroy, OnInit } from '@angular/core';
import { FilesService } from '../../services/files.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-file-dropzone',
  templateUrl: './file-dropzone.component.html',
  styleUrls: ['./file-dropzone.component.css'],
  standalone: false
})
export class FileDropzoneComponent implements OnInit, OnDestroy {
  files: File[] = [];
  subscription!: Subscription;

  constructor(private filesService: FilesService) {}

  ngOnInit() {
    this.subscription = this.filesService.files.subscribe((files) => {
      this.files = files;
    });
  }

  onSelect(event: { addedFiles: any }) {
    let duplicateFiles = [];
    for (let file of event.addedFiles) {
      if (!this.files.some((f) => f.name == file.name)) {
        this.files.push(file);
      } else {
        duplicateFiles.push(file.name);
      }
    }
    if (duplicateFiles.length) {
      console.log(
        'The following files were skipped because they were duplicates: ' +
          duplicateFiles.join(', ')
      );
      Swal.fire({
        position: 'top-end',
        icon: 'warning',
        title:
          `Skipped ${duplicateFiles.length} duplicate file` +
          (duplicateFiles.length > 1 ? 's' : ''),
        showConfirmButton: false,
        timer: 2000,
        backdrop: false
      });
    }
    this.filesService.setFiles(this.files);
  }

  onRemove(event: File) {
    this.files.splice(this.files.indexOf(event), 1);
    this.filesService.setFiles(this.files);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
