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
      let downloadCommands = '';
      if (updatedFiles.length > 0) {
        // Pass the file data as a JSON string to avoid complex escaping issues.
        const filesJson = JSON.stringify(
          updatedFiles.map((file) => ({
            url: file.url,
            filename: file.filename
          }))
        ).replace(/'/g, "''");

        // PowerShell script to download files sequentially with a progress bar and error handling.
        // language=PowerShell
        const pwshScript = `
          $files = '${filesJson}' | ConvertFrom-Json;
          $total = $files.Count;
          $i = 0;
          foreach ($file in $files) {
              $i++;
              $percent = [int](($i / $total) * 100);
              Write-Progress -Activity "Downloading Files" -Status "Downloading $($file.filename) ($i of $total)" -PercentComplete $percent;
              try {
                  Invoke-WebRequest -Uri $file.url -OutFile $file.filename -ErrorAction Stop;
              } catch {
                  Write-Error "ERROR: Failed to download $($file.filename). $_";
              }
          }
        `;

        // Minify the script into a single line.
        downloadCommands = pwshScript.trim().replace(/\s+/g, ' ');
      }

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

      // Parallel File downloads
      const downloadCommands = updatedFiles
        .map((file) => `curl -Lo "${file.filename}" "${file.url}"`)
        .join(' & ');

      // Only add 'wait' if there are commands to run
      const parallelDownloadScript = downloadCommands
        ? `${downloadCommands} & wait`
        : '';

      return [cleanupScript, parallelDownloadScript]
        .filter(Boolean)
        .join(' && ');
    }
  }
}
