import { Injectable } from '@angular/core';
import { GitHub } from '../libraries/github/github';

/**
 * Service that acts as a Wrapper around the GitHub API.
 * (Adheres to the Singleton pattern)
 */
@Injectable({
  providedIn: 'root'
})
export class GitHubService extends GitHub {
  constructor() {
    super();
  }
}
