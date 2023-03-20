import {Loader} from "../../services/loader.service";

export interface Version {
  name: string,
  version_number: string,
  changelog: string,
  dependencies: string[],
  game_versions: string[],
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
  client_side: Environment,
  server_side: Environment,
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

export enum Environment {
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
