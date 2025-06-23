import { Loader } from '../../services/loader.service';
import {RequirementLevel} from "../modrinth/types.modrinth";

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  loader: Loader;
  pattern: RegExp;
  title?: string;
  client?: RequirementLevel
  server?: RequirementLevel
  modrinthPage?: string;
  icon_url?: string;
  description?: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
  html_url: string;
}

export interface GitHubAsset {
  id: number;
  name: string;
  label: string | null;
  content_type: string;
  size: number;
  digest: string;
  download_count: number;
  created_at: string;
  updated_at: string;
  url: string;
  browser_download_url: string;
}

export interface GitHubVersion {
  name: string;
  version_number: string;
  changelog: string;
  date_published: Date;
  downloads: number;
  files: {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
  release_url: string;
}

export interface GitHubProject {
  id: string;
  title: string;
  description: string;
  project_url: string;
  downloads: number;
  updated: Date;
  versions: string[];
  loaders: Loader[];
}

export interface GitHubModInfo {
  project: GitHubProject;
  versions: GitHubVersion[];
  config: GitHubRepoConfig;
}
