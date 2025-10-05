import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { Mod, VersionStatus } from '../mod-panel.component';

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
    // Separate mods into those that are up-to-date and those that need updating.
    const modsToUpdate = this.mods.filter(
      (mod) =>
        mod.versions.find((v) => v.selected)?.versionStatus !==
        VersionStatus.Installed
    );
    const installedUpToDateMods = this.mods.filter(
      (mod) =>
        mod.versions.find((v) => v.selected)?.versionStatus ===
        VersionStatus.Installed
    );

    // Get filenames of mods that are already up-to-date and should be left untouched.
    const upToDateFilenames = installedUpToDateMods
      .map((mod) => mod.originalFile?.name)
      .filter((fn): fn is string => !!fn && fn.trim().length > 0);

    // From the mods that need updating, get the list of old files to delete.
    const filesToDeleteNames = modsToUpdate
      .map((mod) => mod.originalFile?.name)
      .filter((fn): fn is string => !!fn && fn.trim().length > 0);

    // From the mods that need updating, get the list of new files to download.
    const filesToDownload = modsToUpdate
      .map(
        (mod) =>
          mod.versions
            .find((version) => version.selected)!
            .files.find((f) => f.primary)!
      )
      .flat();

    // This list contains all files the script should know about before downloading.
    // Any other file in the directory is considered unknown and will be moved.
    const allKnownCurrentFiles = [...upToDateFilenames, ...filesToDeleteNames];

    if (this.scriptType === 'powershell') {
      // Moves unknown files, then deletes outdated mod files.
      const psKnownFiles = allKnownCurrentFiles.map((f) => `'${f}'`).join(',');
      const psFilesToDelete = filesToDeleteNames.map((f) => `'${f}'`).join(',');

      const moveUnknownScript = `$f=@(${psKnownFiles}); New-Item outdated -Type d -Force >$null; gci -File|?{$_.Name -notin $f}|mi -Dest outdated`;
      const deleteOldFilesScript =
        filesToDeleteNames.length > 0
          ? `ri ${psFilesToDelete} -Force -EA 0`
          : '';
      const cleanupScript = [moveUnknownScript, deleteOldFilesScript]
        .filter(Boolean)
        .join('; ');

      // Download necessary new files.
      let downloadCommands = '';
      if (filesToDownload.length > 0) {
        const filesJson = JSON.stringify(
          filesToDownload.map((file) => ({
            url: file.url,
            filename: file.filename
          }))
        ).replace(/'/g, "''");

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
      // Moves unknown files, then deletes outdated mod files.
      const findExcludes = allKnownCurrentFiles
        .map((f) => `! -name "${f}"`)
        .join(' ');
      const bashFilesToDelete = filesToDeleteNames
        .map((f) => `"${f}"`)
        .join(' ');

      const moveUnknownScript = `mkdir -p outdated && find . -maxdepth 1 -type f ${findExcludes} -exec mv -t outdated/ {} +`;
      const deleteOldFilesScript =
        filesToDeleteNames.length > 0 ? `rm -f ${bashFilesToDelete}` : '';
      const cleanupScript = [moveUnknownScript, deleteOldFilesScript]
        .filter(Boolean)
        .join(' && ');

      // Downloads necessary new files in parallel.
      const downloadCommands = filesToDownload
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
