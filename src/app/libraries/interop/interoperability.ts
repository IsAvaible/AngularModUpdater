import {
  CurseforgeFile,
  CurseforgeMod,
  DependencyType,
  FileReleaseType,
  ModLoaderType,
} from '../curseforge/types.curseforge';
import {
  ModrinthProject,
  ModrinthVersion,
  ProjectType,
  RequirementLevel,
  Status,
  VersionType,
} from '../modrinth/types.modrinth';
import {
  GitHubModInfo,
  GitHubProject,
  GitHubVersion,
} from '../github/types.github';
import { Loader } from '../../services/loader.service';

export class Interoperability {
  /**
   * Converts a Curseforge mod to Modrinth project format
   * @param curseforgeMod The Curseforge mod
   * @public
   */
  public convertCurseforgeToModrinthProject(
    curseforgeMod: CurseforgeMod,
  ): ModrinthProject {
    return {
      id: curseforgeMod.id.toString(),
      slug: curseforgeMod.slug,
      project_type: ProjectType.Mod, // Assume it's a mod,
      project_url: `https://www.curseforge.com/minecraft/mc-mods/${curseforgeMod.slug}`,
      team: 'unknown',
      title: curseforgeMod.name,
      description: curseforgeMod.summary,
      body: curseforgeMod.summary,
      published: curseforgeMod.dateCreated,
      updated: curseforgeMod.dateModified,
      approved: curseforgeMod.dateReleased,
      status: Status.Approved,
      downloads: curseforgeMod.downloadCount,
      followers: 0,
      categories: curseforgeMod.categories.map((cat) => cat.slug),
      additional_categories: [],
      game_versions: [],
      loaders: [],
      versions: curseforgeMod.latestFiles.map((file) => file.id.toString()),
      icon_url: curseforgeMod.logo?.url || null,
      issues_url: curseforgeMod.links.issuesUrl,
      source_url: curseforgeMod.links.sourceUrl,
      wiki_url: curseforgeMod.links.wikiUrl,
      discord_url: null,
      donation_urls: [],
      client_side: RequirementLevel.Unsupported,
      server_side: RequirementLevel.Unsupported,
      color: null,
      moderators_message: null,
      license: null,
      gallery: curseforgeMod.screenshots.map((screenshot) => screenshot.url),
    };
  }

  /**
   * Converts Curseforge file data to Modrinth versions format
   * @param curseforgeFiles The Curseforge files
   * @public
   */
  public convertCurseforgeToModrinthVersions(
    curseforgeFiles: CurseforgeFile[],
  ): ModrinthVersion[] {
    return curseforgeFiles.map((file) =>
      this.convertCurseforgeToModrinthVersion(file),
    );
  }

  /**
   * Converts a Curseforge file to Modrinth version format
   * @param curseforgeFile The Curseforge file
   * @public
   */
  public convertCurseforgeToModrinthVersion(
    curseforgeFile: CurseforgeFile,
  ): ModrinthVersion {
    return {
      requested_status: null,
      status: Status.Approved,
      id: curseforgeFile.id.toString(),
      project_id: curseforgeFile.modId.toString(),
      author_id: 'unknown',
      featured: false,
      name: curseforgeFile.displayName,
      version_number: curseforgeFile.fileName,
      changelog: '',
      changelog_url: null,
      date_published: curseforgeFile.fileDate,
      downloads: curseforgeFile.downloadCount,
      // @ts-ignore
      version_type: this.convertCurseforgeReleaseType(
        curseforgeFile.releaseType,
      ),
      files: [
        {
          url: curseforgeFile.downloadUrl,
          filename: curseforgeFile.fileName,
          primary: true,
          size: curseforgeFile.fileLength,
          file_type: null,
          hashes: {
            sha512: curseforgeFile.fileFingerprint.toString(),
            sha1: curseforgeFile.fileFingerprint.toString(),
          },
        },
      ],
      dependencies: curseforgeFile.dependencies.map((dep) =>
        this.convertCurseforgeDependencyType(dep.relationType),
      ),
      game_versions: curseforgeFile.gameVersions,
      // @ts-ignore
      loaders: this.getLoadersFromCurseforgeFile(curseforgeFile),
    };
  }

  /**
   * Converts Curseforge release type to Modrinth format
   * @param releaseType The Curseforge release type
   * @public
   */
  public convertCurseforgeReleaseType(releaseType: FileReleaseType): string {
    switch (releaseType) {
      case FileReleaseType.Release:
        return 'release';
      case FileReleaseType.Beta:
        return 'beta';
      case FileReleaseType.Alpha:
        return 'alpha';
      default:
        return 'release';
    }
  }

  /**
   * Converts Curseforge dependency type to Modrinth format
   * @param dependencyType The Curseforge dependency type
   * @public
   */
  public convertCurseforgeDependencyType(
    dependencyType: DependencyType,
  ): string {
    switch (dependencyType) {
      case DependencyType.RequiredDependency:
        return 'required';
      case DependencyType.OptionalDependency:
        return 'optional';
      case DependencyType.Incompatible:
        return 'incompatible';
      default:
        return 'optional';
    }
  }

  /**
   * Extracts loader information from Curseforge file
   * @param curseforgeFile The Curseforge file
   * @public
   */
  public getLoadersFromCurseforgeFile(
    curseforgeFile: CurseforgeFile,
  ): string[] {
    const loaders: string[] = [];
    if (
      curseforgeFile.gameVersions.some((v) => v.toLowerCase().includes('forge'))
    ) {
      loaders.push('forge');
    }
    if (
      curseforgeFile.gameVersions.some((v) =>
        v.toLowerCase().includes('fabric'),
      )
    ) {
      loaders.push('fabric');
    }
    if (
      curseforgeFile.gameVersions.some((v) => v.toLowerCase().includes('quilt'))
    ) {
      loaders.push('quilt');
    }
    return loaders;
  }

  /**
   * Converts a Curseforge Loader to Modrinth Loader
   * @param loader The Curseforge Loader
   * @public
   */
  public convertCurseforgeLoaderToModrinthLoader(
    loader: ModLoaderType,
  ): Loader | null {
    switch (loader) {
      case ModLoaderType.Fabric:
        return Loader.fabric;
      case ModLoaderType.Forge:
        return Loader.forge;
      case ModLoaderType.Quilt:
        return Loader.quilt;
      default:
        return null;
    }
  }

  /**
   * Converts GitHub mod info to Modrinth project format
   * @param modInfo The GitHub mod info
   * @public
   */
  public convertGitHubToModrinthProject(
    modInfo: GitHubModInfo,
  ): ModrinthProject {
    return {
      id: modInfo.project.id,
      slug: modInfo.project.id.replace('/', '-'),
      title: modInfo.project.title,
      description: modInfo.config.description || 'Github Repository',
      project_url: modInfo.project.project_url,
      project_type: ProjectType.Mod,
      downloads: modInfo.project.downloads,
      updated: modInfo.project.updated,
      published: new Date(), // GitHub doesn't provide creation date easily
      approved: null,
      status: Status.Approved,
      versions: modInfo.project.versions,
      loaders: modInfo.project.loaders,
      categories: [],
      client_side: modInfo.config.client || RequirementLevel.Required,
      server_side: modInfo.config.server || RequirementLevel.Optional,
      body: modInfo.project.description,
      additional_categories: null,
      issues_url: modInfo.project.project_url + '/issues',
      source_url: modInfo.project.project_url,
      wiki_url: null,
      discord_url: null,
      donation_urls: null,
      icon_url: modInfo.config.icon_url || null,
      color: null,
      team: 'unknown',
      moderators_message: null,
      followers: 0,
      license: null,
      game_versions: [],
      gallery: [],
    };
  }

  /**
   * Converts GitHub versions to Modrinth versions format
   * @param versions The GitHub versions
   * @param projectId The project ID
   * @param mcVersion The selected minecraft version
   * @param authorId The author ID (repository owner)
   * @public
   */
  public convertGitHubToModrinthVersions(
    versions: GitHubVersion[],
    projectId: string,
    mcVersion: string,
    authorId: string,
  ): ModrinthVersion[] {
    return versions.map((version) =>
      this.convertGitHubToModrinthVersion(
        version,
        projectId,
        mcVersion,
        authorId,
      ),
    );
  }

  /**
   * Converts a GitHub version to Modrinth version format
   * @param version The GitHub version
   * @param projectId The project ID
   * @param mcVersion The selected minecraft version
   * @param authorId The author ID (repository owner)
   * @public
   */
  public convertGitHubToModrinthVersion(
    version: GitHubVersion,
    projectId: string,
    mcVersion: string,
    authorId: string,
  ): ModrinthVersion {
    return {
      name: version.name,
      version_number: version.version_number,
      changelog: version.changelog,
      dependencies: [],
      game_versions: [mcVersion], // Assume compatibility with selected version
      version_type: VersionType.Release,
      loaders: [], // Will be filled by the calling code
      featured: false,
      status: Status.Approved,
      requested_status: null,
      id: `github-${projectId}-${version.version_number}`,
      project_id: projectId,
      author_id: authorId,
      date_published: version.date_published,
      downloads: version.downloads,
      files: version.files.map((file) => ({
        hashes: { sha512: '', sha1: '' }, // GitHub doesn't provide hashes
        url: file.url,
        filename: file.filename,
        primary: file.primary,
        size: file.size,
        file_type: null,
      })),
    };
  }

  /**
   * Creates a mock installed version for GitHub mods for comparison
   * @param filename The filename of the installed mod
   * @param projectId The project ID
   * @public
   */
  public createGitHubInstalledVersion(
    filename: string,
    projectId: string,
  ): ModrinthVersion {
    const versionMatch = filename.match(/1.\d{1,2}.\d{1,2}/);
    const version = versionMatch ? versionMatch[0] : null;

    return {
      name: `Installed: ${filename}`,
      version_number: 'installed',
      changelog: '',
      dependencies: [],
      game_versions: version ? [version] : [],
      version_type: VersionType.Release,
      loaders: [],
      featured: false,
      status: Status.Approved,
      requested_status: null,
      id: `github-installed-${filename}`,
      project_id: projectId,
      author_id: 'github',
      date_published: new Date(0), // Very old date to ensure updates are detected
      downloads: 0,
      files: [
        {
          hashes: { sha512: '', sha1: '' },
          url: '',
          filename: filename,
          primary: true,
          size: 0,
          file_type: null,
        },
      ],
    };
  }
}
