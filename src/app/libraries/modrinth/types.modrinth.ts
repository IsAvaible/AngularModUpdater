import {Loader} from "../../services/loader.service";

export interface Version {
  name: string,
  version_number: string,
  changelog: string,
  dependencies: string[],
  game_versions: string[],
  version_type: VersionType,
  loaders: Loader[],
  featured: boolean,
  status: Status,
  requested_status: Status | null,
  id: string,
  project_id: string,
  author_id: string,
  date_published: Date,
  downloads: number,
  files: {
    hashes: {sha512: string, sha1: string},
    url: string,
    filename: string,
    primary: boolean,
    size: number,
    file_type: string | null
  }[],
}

export interface Project {
  slug: string,
  title: string,
  description: string,
  categories: string[],
  client_side: RequirementLevel,
  server_side: RequirementLevel,
  body: string,
  additional_categories: string[][] | null,
  issues_url: string | null,
  source_url: string | null,
  wiki_url: string | null,
  discord_url: string | null,
  donation_urls: string[] | null,
  project_type: ProjectType,
  downloads: number,
  icon_url: string | null,
  color: number | null,
  id: string,
  team: string,
  moderators_message: any | null,
  published: Date,
  updated: Date,
  approved: Date | null,
  followers: number,
  status: Status,
  license: string | null,
  versions: string[],
  game_versions: string[],
  loaders: Loader[],
  gallery: string[],
}

export enum VersionType {
  Release = "release",
  Beta = "beta",
  Alpha = "alpha"
}

export enum RequirementLevel {
  Required= "required",
  Optional = "optional",
  Unsupported = "unsupported"
}

export enum ProjectType {
  Mod = "mod",
  ResourcePack = "resourcepack",
  ModPack = "modpack",
  Shader = "shader",
}

export enum Status {
  Approved = "approved",
  Rejected = "rejected",
  Draft = "draft",
  Unlisted = "unlisted",
  Archived = "archived",
  Processing = "processing",
  Unknown = "unknown",
}

export interface Modpack {
  formatVersion: number;
  game: string;
  name: string;
  versionId: string;
  dependencies: { [key: string]: string };
  files: Array<{
    path: string;
    hashes: { [algorithm: string]: string };
    downloads: string[];
    env: {
      client: RequirementLevel;
      server: RequirementLevel;
    };
    fileSize: number;
  }>;
}

export enum ProjectType {
  MOD = 'mod',
  MODPACK = 'modpack',
  RESOURCEPACK = 'resourcepack',
  SHADER = 'shader',
}

export enum IndexerSort {
  RELEVANCE = 'relevance',
  DOWNLOADS = 'downloads',
  FOLLOWS = 'follows',
  NEWEST = 'newest',
  UPDATED = 'updated',
  FEATURED = 'featured',
}

export interface SearchProjectsParams {
  query: string;
  limit?: number;
  offset?: number;
  facets?: string[][];
  index?: IndexerSort;
  versions?: string[];
  license?: string;
  project_type?: ProjectType;
  categories?: string[];
  client_side?: 'optional' | 'required' | 'unsupported' | 'unknown';
  server_side?: 'optional' | 'required' | 'unsupported' | 'unknown';
  featured?: boolean;
}

export interface SearchResult {
  hits: {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    client_side: string;
    server_side: string;
    versions: string[];
    downloads: number;
    follows: number;
    icon_url?: string;
    // Include other relevant fields as per Modrinth's API response
  }[];
  total_hits: number;
  offset: number;
  limit: number;
}

export interface AnnotatedError {error: any}
