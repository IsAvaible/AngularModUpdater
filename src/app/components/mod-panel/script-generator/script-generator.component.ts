import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { Mod } from '../mod-panel.component';

@Component({
  selector: 'app-script-generator',
  templateUrl: './script-generator.component.html',
  styleUrls: ['./script-generator.component.css'],
  standalone: false
})
export class ScriptGeneratorComponent implements OnInit, OnChanges {
  @Input() mods: Mod[] = [];
  @Output() closeEvent = new EventEmitter<void>();

  scriptType: 'powershell' | 'bash' = 'powershell';
  generatedScript = '';

  ngOnInit(): void {
    if (this.mods && this.mods.length > 0) {
      this.generateScript();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mods'] && changes['mods'].currentValue) {
      this.generateScript();
    }
  }

  close() {
    this.closeEvent.emit();
  }

  generateScript() {
    this.generatedScript = this.createScript();
  }

  createScript() {
    const originalFileNames = this.mods
      .map((mod) => mod.originalFile?.name)
      .filter((fn) => fn && fn.trim().length > 0);
    const updatedFiles = this.mods
      .map(
        (mod) =>
          mod.versions
            .find((version) => version.selected)!
            .files.find((f) => f.primary)!
      )
      .flat();

    if (this.scriptType === 'powershell') {
      // File cleanup
      const psFiles = originalFileNames.map((f) => `'${f}'`).join(',');
      const filesToDelete =
        originalFileNames.length > 0 ? `ri ${psFiles} -Force -EA 0` : '';
      const cleanupScript = `$f=@(${psFiles}); New-Item outdated -Type d -Force >$null; gci -File|?{$_.Name -notin $f}|mi -Dest outdated; ${filesToDelete}`;

      // File downloads
      const downloadCommands = updatedFiles
        .map(
          (file) =>
            `Invoke-WebRequest -Uri '${file.url}' -OutFile '${file.filename}'`
        )
        .join('; ');

      return [cleanupScript, downloadCommands].filter(Boolean).join('; ');
    } else {
      // File cleanup
      const bashFiles = originalFileNames.map((f) => `"${f}"`).join(' ');
      const findExcludes = originalFileNames
        .map((f) => `! -name "${f}"`)
        .join(' ');
      const filesToDelete =
        originalFileNames.length > 0 ? `&& rm -f ${bashFiles}` : '';
      const cleanupScript = `mkdir -p outdated && find . -maxdepth 1 -type f ${findExcludes} -exec mv -t outdated/ {} + ${filesToDelete}`;

      // File downloads
      const downloadCommands = updatedFiles
        .map((file) => `curl -Lo "${file.filename}" "${file.url}"`)
        .join(' && ');

      return [cleanupScript, downloadCommands].filter(Boolean).join(' && ');
    }
  }
}
