import {Version, Project} from "./types.modrinth";
import {catchError, Observable, of} from "rxjs";
import {HttpClient} from "@angular/common/http";


export class Modrinth {
  public modrinthAPIUrl = 'https://api.modrinth.com/v2';  // Modrinth API Endpoint
  public headers = {"Access-Control-Allow-Origin": this.modrinthAPIUrl, "Content-Type": "text/plain"};  // Headers for the requests

  private _rateLimit_Limit: number = 300;  // Rate limit maximum per minute
  private _rateLimit_Remaining: number = 300;  // Requests remaining
  private _rateLimit_Reset: number = 0;  // Seconds until the rate limit resets
  private sha1 = require('js-sha1');  // SHA1 hashing function

  get rateLimit_Limit(): number {
    return this._rateLimit_Limit;
  }
  get rateLimit_Remaining(): number {
    return this._rateLimit_Remaining;
  }
  get rateLimit_Reset(): number {
    return this._rateLimit_Reset;
  }


  constructor(private http: HttpClient) {}

  /**
   * Returns an error handler, that handles the rate limit of the Modrinth API
   * @param result Default value to return if the request fails
   */
  private errorHandler<T>(result?: T) {
    return (error: any): Observable<T> => {
      console.log(error);
      let responseHeaders = error.headers;
      this._rateLimit_Limit = parseInt(<string>responseHeaders.get('X-RateLimit-Limit'));
      this._rateLimit_Remaining = parseInt(<string>responseHeaders.get('X-RateLimit-Remaining'));
      this._rateLimit_Reset = parseInt(<string>responseHeaders.get('X-RateLimit-Reset'));

      if (this._rateLimit_Remaining == 0) {
        console.log(`Rate limit reached. Waiting for ${this._rateLimit_Reset} seconds before retrying.`)
        new Promise(() => setTimeout(
          () => {
            return this.http.get<Project>(error.url, {headers: this.headers}).pipe(this.errorHandler(result as T))
          },
          (this._rateLimit_Reset + 1) * 1000
        )).then((value) => {
          return value
        });
      }
      return of(result as T);
    };
  }

  public getProject(slug: string): Observable<Project | null> {
    const url =`${this.modrinthAPIUrl}/project/${slug}`
    return this.http.get<Project>(url,{headers: this.headers}).pipe(catchError(this.errorHandler(null)));
  }

  public getVersionFromSlug(slug: string, version: string, loaders: string[]): Observable<Version[]> {
    const url = `${this.modrinthAPIUrl}/project/${slug}/version?game_versions=["${version}"]` + (loaders.length ? `&loaders=["${loaders.map(loader => loader.toLowerCase())[0]}"]` : "")
    return this.http.get<Version[]>(url, {headers: this.headers}).pipe(catchError(this.errorHandler([])));
  }

  public getVersionFromHash(hash: string): Observable<Version[]> {
    const url = `${this.modrinthAPIUrl}/version/${hash}`;
    return this.http.get<Version[]>(url, {headers: this.headers}).pipe(catchError(this.errorHandler([])));
  }

  public getVersionFromBuffer(buffer: ArrayBuffer): Observable<Version[]> {
    const fileHash = this.sha1(buffer);
    return this.getVersionFromHash(fileHash);
  }
}
