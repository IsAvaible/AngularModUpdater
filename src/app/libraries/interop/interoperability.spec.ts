import { Interoperability } from './interoperability';
import {
  CurseforgeFile,
  CurseforgeMod,
  DependencyType,
  FileReleaseType,
  ModLoaderType
} from '../curseforge/types.curseforge';
import {
  ModrinthProject,
  ModrinthVersion,
  ProjectType,
  RequirementLevel,
  Status,
  VersionType
} from '../modrinth/types.modrinth';
import { GitHubModInfo, GitHubVersion } from '../github/types.github';
import { Loader } from '../../services/loader.service';

describe('Interoperability', () => {
  let interop: Interoperability;

  beforeEach(() => {
    interop = new Interoperability();
  });

  describe('CurseForge to Modrinth Project Conversion', () => {
    it('should convert CurseForge mod to Modrinth project format', () => {
      const mockCfMod: Partial<CurseforgeMod> = {
        id: 12345,
        slug: 'test-mod',
        name: 'Test Mod',
        summary: 'A test summary',
        dateCreated: new Date('2026-01-01T00:00:00Z'),
        dateModified: new Date('2026-02-01T00:00:00Z'),
        dateReleased: new Date('2026-02-01T00:00:00Z'),
        downloadCount: 1000,
        categories: [{ id: 1, name: 'Adventure', slug: 'adventure' } as any],
        latestFiles: [
          {
            id: 9999,
            modId: 12345,
            displayName: 'Test File',
            fileName: 'test-file.jar',
            fileDate: new Date('2026-02-01T00:00:00Z'),
            fileLength: 500,
            releaseType: FileReleaseType.Release,
            downloadUrl: 'http://test.url',
            downloadCount: 50,
            fileFingerprint: 1234567,
            gameVersions: ['1.20.1', 'Fabric']
          } as any
        ],
        logo: { url: 'http://logo.url' } as any,
        links: {
          issuesUrl: 'http://issues.url',
          sourceUrl: 'http://source.url',
          wikiUrl: 'http://wiki.url'
        } as any,
        screenshots: [{ url: 'http://screenshot.url' }] as any
      };

      const project = interop.convertCurseforgeToModrinthProject(mockCfMod as CurseforgeMod);

      expect(project.id).toBe('12345');
      expect(project.slug).toBe('test-mod');
      expect(project.title).toBe('Test Mod');
      expect(project.description).toBe('A test summary');
      expect(project.project_url).toContain('test-mod');
      expect(project.downloads).toBe(1000);
      expect(project.categories).toEqual(['adventure']);
      expect(project.icon_url).toBe('http://logo.url');
      expect(project.issues_url).toBe('http://issues.url');
      expect(project.source_url).toBe('http://source.url');
      expect(project.wiki_url).toBe('http://wiki.url');
      expect(project.gallery).toEqual(['http://screenshot.url']);
    });
  });

  describe('CurseForge File to Modrinth Version Conversion', () => {
    it('should convert CurseForge file to Modrinth version format', () => {
      const mockFile: Partial<CurseforgeFile> = {
        id: 9999,
        modId: 12345,
        displayName: 'Test Version 1.0',
        fileName: 'test-v1.0.jar',
        fileDate: new Date('2026-02-01T00:00:00Z'),
        fileLength: 1024,
        releaseType: FileReleaseType.Beta,
        downloadUrl: 'http://test.url/download',
        downloadCount: 10,
        fileFingerprint: 7654321,
        gameVersions: ['1.20.1', 'Fabric', 'Forge']
      };

      const version = interop.convertCurseforgeToModrinthVersion(mockFile as CurseforgeFile);

      expect(version.id).toBe('9999');
      expect(version.project_id).toBe('12345');
      expect(version.name).toBe('Test Version 1.0');
      expect(version.version_number).toBe('test-v1.0.jar');
      expect(version.date_published).toEqual(mockFile.fileDate as Date);
      expect(version.version_type).toBe('beta');
      expect(version.loaders as any).toEqual(['forge', 'fabric']);
      expect(version.files[0].url).toBe('http://test.url/download');
      expect(version.files[0].filename).toBe('test-v1.0.jar');
      expect(version.files[0].size).toBe(1024);
    });

    it('should convert CurseForge release types correctly', () => {
      expect(interop.convertCurseforgeReleaseType(FileReleaseType.Release)).toBe('release');
      expect(interop.convertCurseforgeReleaseType(FileReleaseType.Beta)).toBe('beta');
      expect(interop.convertCurseforgeReleaseType(FileReleaseType.Alpha)).toBe('alpha');
    });

    it('should convert CurseForge dependency types correctly', () => {
      expect(interop.convertCurseforgeDependencyType(DependencyType.RequiredDependency)).toBe('required');
      expect(interop.convertCurseforgeDependencyType(DependencyType.OptionalDependency)).toBe('optional');
      expect(interop.convertCurseforgeDependencyType(DependencyType.Incompatible)).toBe('incompatible');
    });

    it('should convert CurseForge loaders to Modrinth loaders correctly', () => {
      expect(interop.convertCurseforgeLoaderToModrinthLoader(ModLoaderType.Fabric)).toBe(Loader.fabric);
      expect(interop.convertCurseforgeLoaderToModrinthLoader(ModLoaderType.Forge)).toBe(Loader.forge);
      expect(interop.convertCurseforgeLoaderToModrinthLoader(ModLoaderType.Quilt)).toBe(Loader.quilt);
      expect(interop.convertCurseforgeLoaderToModrinthLoader(ModLoaderType.NeoForge)).toBe(Loader.neoforge);
    });
  });

  describe('GitHub to Modrinth Project/Version Conversion', () => {
    it('should convert GitHub mod info to Modrinth project format', () => {
      const mockGitHubModInfo: GitHubModInfo = {
        project: {
          id: 'test-owner/test-repo',
          title: 'Test Title',
          downloads: 500,
          updated: new Date('2026-03-01T00:00:00Z'),
          versions: ['1.0.0'],
          loaders: [Loader.fabric],
          description: 'A test repository',
          project_url: 'https://github.com/test-owner/test-repo'
        },
        config: {
          owner: 'test-owner',
          repo: 'test-repo',
          loader: Loader.fabric,
          pattern: /.*/,
          modrinthPage: 'abc',
          description: 'Custom config desc',
          icon_url: 'http://custom-icon.png',
          client: RequirementLevel.Required,
          server: RequirementLevel.Unsupported
        },
        versions: []
      };

      const project = interop.convertGitHubToModrinthProject(mockGitHubModInfo);

      expect(project.id).toBe('test-owner/test-repo');
      expect(project.slug).toBe('test-owner-test-repo');
      expect(project.title).toBe('Test Title');
      expect(project.description).toBe('Custom config desc');
      expect(project.project_url).toBe('https://github.com/test-owner/test-repo');
      expect(project.project_type).toBe(ProjectType.Mod);
      expect(project.downloads).toBe(500);
      expect(project.icon_url).toBe('http://custom-icon.png');
      expect(project.client_side).toBe(RequirementLevel.Required);
      expect(project.server_side).toBe(RequirementLevel.Unsupported);
    });

    it('should convert GitHub version to Modrinth version format', () => {
      const mockVersion: Partial<GitHubVersion> = {
        name: 'Release 1.0.0',
        version_number: '1.0.0',
        changelog: 'Awesome release notes',
        date_published: new Date('2026-03-01T00:00:00Z'),
        downloads: 25,
        files: [
          {
            url: 'http://github/test/asset.jar',
            filename: 'asset.jar',
            primary: true,
            size: 2048
          }
        ]
      };

      const version = interop.convertGitHubToModrinthVersion(
        mockVersion as GitHubVersion,
        'test-project-id',
        '1.20.1',
        'test-owner'
      );

      expect(version.id).toBe('github-test-project-id-1.0.0');
      expect(version.project_id).toBe('test-project-id');
      expect(version.name).toBe('Release 1.0.0');
      expect(version.version_number).toBe('1.0.0');
      expect(version.changelog).toBe('Awesome release notes');
      expect(version.game_versions).toEqual(['1.20.1']);
      expect(version.author_id).toBe('test-owner');
      expect(version.files[0].url).toBe('http://github/test/asset.jar');
      expect(version.files[0].filename).toBe('asset.jar');
      expect(version.files[0].size).toBe(2048);
    });

    it('should create mock installed version for GitHub mods', () => {
      const version = interop.createGitHubInstalledVersion(
        'litematica-fabric-1.20.1-sakura.2.jar',
        'sakura-ryoko/litematica'
      );

      expect(version.id).toBe('github-installed-litematica-fabric-1.20.1-sakura.2.jar');
      expect(version.project_id).toBe('sakura-ryoko/litematica');
      expect(version.game_versions).toEqual(['1.20.1']);
      expect(version.version_number).toBe('installed');
      expect(version.files[0].filename).toBe('litematica-fabric-1.20.1-sakura.2.jar');
    });
  });
});
