import {Version, Project, AnnotatedError} from "./types.modrinth";
import {catchError, map, Observable, of} from "rxjs";
import {HttpClient} from "@angular/common/http";
import Swal from "sweetalert2";
import {inject} from "@angular/core";


export class Modrinth {
  private static _instance: Modrinth;

  public modrinthAPIUrl = 'https://api.modrinth.com/v2';  // Modrinth API Endpoint
  public headers = {"Access-Control-Allow-Origin": this.modrinthAPIUrl, "Content-Type": "text/plain"};  // Headers for the requests

  private _rateLimit_Limit: number = 300;  // Rate limit maximum per minute
  private _rateLimit_Remaining: number = 300;  // Requests remaining
  private _rateLimit_Reset: number = 0;  // Seconds until the rate limit resets
  private sha1 = require('js-sha1');  // SHA1 hashing function
  private intervalRequestStart: Date | null = null;

  constructor() {}
  private http = inject(HttpClient);

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  get rateLimit_Limit(): number {
    return this._rateLimit_Limit;
  }
  get rateLimit_Remaining(): number {
    return this._rateLimit_Remaining;
  }
  get rateLimit_Reset(): number {
    return this._rateLimit_Reset;
  }

  /**
   * Returns an error handler, that handles the rate limit of the Modrinth API
   */
  private errorHandler<T>() {
    return (error: any): Observable<T> => {
      if (this._rateLimit_Remaining == 0 || error.status == 0 && this._rateLimit_Remaining != -1) {
        // The workaround (client side tracking of the rate limit) might be wrong. In this case the status is 0
        let statusCase = this._rateLimit_Remaining != 0;
        let timerInterval: any;
        if (statusCase) {
          this._rateLimit_Reset = 30;
          console.log(this._rateLimit_Remaining);
        }
        this._rateLimit_Remaining = -1;
        console.log(`Rate limit reached. Wait for ${this._rateLimit_Reset} seconds before retrying.`);
        // Fire a sweet alert
        Swal.fire({
          position: 'top-start',
          icon: 'error',
          title: 'Rate Limit Exceeded',
          html: `Modrinths rate limit was reached, please try again in <b>${this._rateLimit_Reset}</b> seconds${statusCase ? ' (approximated)':''}.`,
          showConfirmButton: false,
          timer: this._rateLimit_Reset * 1000,
          timerProgressBar: true,
          backdrop: false,
          didOpen: () => {
            const b: HTMLElement = Swal.getHtmlContainer()!.querySelector('b')!;
            timerInterval = setInterval(() => {
              b.textContent = String(Math.round(Swal.getTimerLeft()! / 1000));
            }, 100)
          },
          willClose: () => {
            clearInterval(timerInterval)
          }
        })
        if (statusCase) setTimeout(() => this._rateLimit_Remaining = 0, 30 * 1000)
      }
      return of({error: error} as T);

      // Not able to get the headers, because of CORS issues
      // let responseHeaders = error.headers;
      // this._rateLimit_Limit = parseInt(<string>responseHeaders.get('X-RateLimit-Limit'));
      // this._rateLimit_Remaining = parseInt(<string>responseHeaders.get('X-RateLimit-Remaining'));
      // this._rateLimit_Reset = parseInt(<string>responseHeaders.get('X-RateLimit-Reset'));
      //
      // if (this._rateLimit_Remaining == 0) {
      //   console.log(`Rate limit reached. Waiting for ${this._rateLimit_Reset} seconds before retrying.`)
      //   return this.http.get<T>(error.url, {headers: this.headers}).pipe(this.errorHandler<T>());
      // } else {
      //   return of({error: error} as T);
      // }
    };
  }

  /**
   * Adjusts the rate limit of the Modrinth API
   *
   * The Modrinth API has a rate limit of 300 requests per minute. This function reduces the remaining requests by 1
   * and starts a timer that resets the remaining requests to 300 after 60 seconds.
   *
   * NOTE: This is a workaround as the API does not return the rate limit headers (CORS issue). catchError() should be in charge of this.
   * TODO: Remove this function after fixing the CORS issue
   * @private
   */
  private adjustRateLimit() {
    if (this._rateLimit_Remaining > 0) this._rateLimit_Remaining -= 1;  // Reduce the remaining requests by 1
    if (this.intervalRequestStart != null) return  // If the interval is already running, return
    const temp = new Date();
    this.intervalRequestStart = temp;
    this._rateLimit_Reset = 60;
    setInterval(() => {
      if (this._rateLimit_Reset <= 0) {
        this.intervalRequestStart = null;
        this._rateLimit_Remaining = 300;
        // @ts-ignore
        clearInterval(this);
      } else {
        this._rateLimit_Reset -= 1;
      }
    }, 1000);
  }

  private parseProject(project: Project): Project {
    project.published = new Date(project.published);
    project.updated = new Date(project.updated);
    if (project.approved != null) project.approved = new Date(project.approved);
    return project;
  }
  private parseVersion(version: Version): Version {
    version.date_published = new Date(version.date_published);
    return version;
  }
  private parseVersions(versions: Version[]): Version[] {
    return versions.map(this.parseVersion);
  }

  /**
   * Returns the project with the given slug
   * @param slug The slug of the project
   */
  public getProject(slug: string): Observable<Project | AnnotatedError> {
    this.adjustRateLimit();
    const url =`${this.modrinthAPIUrl}/project/${slug}`;
    return this.http.get<Project>(url,{headers: this.headers}).pipe(map(this.parseProject), catchError(this.errorHandler<Project | AnnotatedError>()));
  }

  /**
   * Returns the versions of the project with the given slug
   * @param slug The slug of the project
   * @param version The accepted game version
   * @param loaders The accepted loaders
   */
  public getVersionsFromSlug(slug: string, version: string, loaders: string[]): Observable<Version[] | AnnotatedError> {
    this.adjustRateLimit();
    const url = `${this.modrinthAPIUrl}/project/${slug}/version?game_versions=["${version}"]` + (loaders.length ? `&loaders=["${loaders.map(loader => loader.toLowerCase())[0]}"]` : "")
    return this.http.get<Version[]>(url, {headers: this.headers}).pipe(map(resp => this.parseVersions(resp)), catchError(this.errorHandler<Version[] | AnnotatedError>()));
  }

  /**
   * Returns the version with the given hash
   * @param hash The sha-1 hash of the binary representation of the mod file
   */
  public getVersionFromHash(hash: string): Observable<Version | AnnotatedError> {
    this.adjustRateLimit();
    const url = `${this.modrinthAPIUrl}/version_file/${hash}`;
    return this.http.get<Version>(url, {headers: this.headers}).pipe(map(this.parseVersion), catchError(this.errorHandler<Version | AnnotatedError>()));
  }

  /**
   * Returns the version from the given buffer (binary representation of the mod file)
   * @param buffer The binary representation of the mod file
   */
  public getVersionFromBuffer(buffer: ArrayBuffer): Observable<Version | AnnotatedError> {
    const fileHash = this.sha1(buffer);
    return this.getVersionFromHash(fileHash);
  }

  /**
   * Checks if the given object is an annotated error
   * @param object The object to check
   */
  public isAnnotatedError(object: any): object is AnnotatedError {
    return !!((object as AnnotatedError).error);
  }
}
