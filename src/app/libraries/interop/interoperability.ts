import {
    CurseforgeFile,
    CurseforgeMod,
    DependencyType,
    FileReleaseType,
    ModLoaderType
} from "../curseforge/types.curseforge";
import {ModrinthProject, ModrinthVersion, ProjectType, RequirementLevel, Status} from "../modrinth/types.modrinth";
import {Loader} from "../../services/loader.service";

export class Interoperability {
    /**
     * Converts a Curseforge mod to Modrinth project format
     * @param curseforgeMod The Curseforge mod
     * @public
     */
    public convertCurseforgeToModrinthProject(curseforgeMod: CurseforgeMod): ModrinthProject {
        return {
            id: curseforgeMod.id.toString(),
            slug: curseforgeMod.slug,
            project_type: ProjectType.Mod, // Assume it's a mod,
            project_url: `https://www.curseforge.com/minecraft/mc-mods/${curseforgeMod.slug}`,
            team: "unknown",
            title: curseforgeMod.name,
            description: curseforgeMod.summary,
            body: curseforgeMod.summary,
            published: curseforgeMod.dateCreated,
            updated: curseforgeMod.dateModified,
            approved: curseforgeMod.dateReleased,
            status: Status.Approved,
            downloads: curseforgeMod.downloadCount,
            followers: 0,
            categories: curseforgeMod.categories.map(cat => cat.slug),
            additional_categories: [],
            game_versions: [],
            loaders: [],
            versions: curseforgeMod.latestFiles.map(file => file.id.toString()),
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
            gallery: curseforgeMod.screenshots.map(screenshot => screenshot.url)
        };
    }

    /**
     * Converts Curseforge file data to Modrinth versions format
     * @param curseforgeFile The Curseforge file
     * @public
     */
    public convertCurseforgeToModrinthVersions(curseforgeFiles: CurseforgeFile[]): ModrinthVersion[] {
        return curseforgeFiles.map(file => this.convertCurseforgeToModrinthVersion(file));
    }

    /**
     * Converts a Curseforge file to Modrinth version format
     * @param curseforgeFile The Curseforge file
     * @public
     */
    public convertCurseforgeToModrinthVersion(curseforgeFile: CurseforgeFile): ModrinthVersion {
        return {
            requested_status: null,
            status: Status.Approved,
            id: curseforgeFile.id.toString(),
            project_id: curseforgeFile.modId.toString(),
            author_id: "unknown",
            featured: false,
            name: curseforgeFile.displayName,
            version_number: curseforgeFile.fileName,
            changelog: "",
            changelog_url: null,
            date_published: curseforgeFile.fileDate,
            downloads: curseforgeFile.downloadCount,
            // @ts-ignore
            version_type: this.convertCurseforgeReleaseType(curseforgeFile.releaseType),
            files: [{
                url: curseforgeFile.downloadUrl,
                filename: curseforgeFile.fileName,
                primary: true,
                size: curseforgeFile.fileLength,
                file_type: null,
                hashes: {
                    sha512: curseforgeFile.fileFingerprint.toString(),
                    sha1: curseforgeFile.fileFingerprint.toString()
                }
            }],
            dependencies: curseforgeFile.dependencies.map(dep => (this.convertCurseforgeDependencyType(dep.relationType))),
            game_versions: curseforgeFile.gameVersions,
            // @ts-ignore
            loaders: this.getLoadersFromCurseforgeFile(curseforgeFile)
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
                return "release";
            case FileReleaseType.Beta:
                return "beta";
            case FileReleaseType.Alpha:
                return "alpha";
            default:
                return "release";
        }
    }

    /**
     * Converts Curseforge dependency type to Modrinth format
     * @param dependencyType The Curseforge dependency type
     * @public
     */
    public convertCurseforgeDependencyType(dependencyType: DependencyType): string {
        switch (dependencyType) {
            case DependencyType.RequiredDependency:
                return "required";
            case DependencyType.OptionalDependency:
                return "optional";
            case DependencyType.Incompatible:
                return "incompatible";
            default:
                return "optional";
        }
    }

    /**
     * Extracts loader information from Curseforge file
     * @param curseforgeFile The Curseforge file
     * @public
     */
    public getLoadersFromCurseforgeFile(curseforgeFile: CurseforgeFile): string[] {
        const loaders: string[] = [];
        if (curseforgeFile.gameVersions.some(v => v.toLowerCase().includes("forge"))) {
            loaders.push("forge");
        }
        if (curseforgeFile.gameVersions.some(v => v.toLowerCase().includes("fabric"))) {
            loaders.push("fabric");
        }
        if (curseforgeFile.gameVersions.some(v => v.toLowerCase().includes("quilt"))) {
            loaders.push("quilt");
        }
        return loaders;
    }

    /**
     * Converts a Curseforge Loader to Modrinth Loader
     * @param loader The Curseforge Loader
     * @public
     */
    public convertCurseforgeLoaderToModrinthLoader(loader: ModLoaderType): Loader | null {
        switch (loader) {
            case ModLoaderType.Fabric:
                return Loader.fabric
            case ModLoaderType.Forge:
                return Loader.forge
            case ModLoaderType.Quilt:
                return Loader.quilt
            default:
                return null
        }
    }

}
