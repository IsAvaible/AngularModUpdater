import { interval, map, Observable, of, startWith } from 'rxjs';
import Swal from 'sweetalert2';
import { HttpHeaders } from '@angular/common/http';

export abstract class RateLimitedApi {
  protected abstract apiName: string;

  // The current rate limit details
  protected _rateLimit: RateLimitInfo | null = null;
  // The rate limit information for fallback client-side tracking
  protected get _rateLimitInfo(): RateLimitInfo | null {
    return null; // Override this in subclasses to provide client-side rate limit info
  }

  private _rateLimitTimer: NodeJS.Timeout | null = null;
  private _isClientSideRateLimit: boolean = false;

  // ===== PUBLIC API =====
  /**
   * Get current rate limit information
   */
  public getRateLimitInfo(): RateLimitInfo | null {
    return this._rateLimit === null ? null : { ...this._rateLimit };
  }

  // The maximum number of requests allowed in the current period
  public get rateLimitLimit(): RateLimitInfo['limit'] | null {
    return this._rateLimit?.limit ?? null;
  }
  // The number of requests remaining in the current period
  public get rateLimitRemaining(): RateLimitInfo['remaining'] | null {
    return this._rateLimit?.remaining ?? null;
  }
  // The time when the rate limit resets
  public get rateLimitResetTime(): RateLimitInfo['resetTime'] {
    return this._rateLimit?.resetTime ?? null;
  }
  // Whether the rate limit is being tracked client-side
  public get isClientSideRateLimit(): boolean {
    return this._isClientSideRateLimit;
  }

  /**
   * Get time until rate limit reset in seconds
   */
  public getRateLimitSecondsUntilReset(): number | null {
    if (this._rateLimit === null || this._rateLimit.resetTime === null) {
      return null;
    }
    const now = new Date();
    return Math.max(
      0,
      Math.round((this._rateLimit.resetTime.getTime() - now.getTime()) / 1000),
    );
  }
  public getRateLimitSecondsUntilReset$ = interval(1000).pipe(
    startWith(this.getRateLimitSecondsUntilReset()),
    map(() => this.getRateLimitSecondsUntilReset()),
  );

  // ===== PROTECTED HELPERS =====

  /**
   * Track rate limiting for HTTP responses
   */
  protected trackRateLimit(headers?: HttpHeaders): void {
    // Try to extract rate limit info from headers
    const limit = this.extractRateLimitHeader(headers, 'limit');
    const remaining = this.extractRateLimitHeader(headers, 'remaining');
    const resetTime = this.extractRateLimitHeader(headers, 'reset');

    // If no headers available, use client-side tracking
    if (limit === null || remaining === null || resetTime === null) {
      this.clientSideRateLimit();
    } else {
      this._rateLimit = {
        limit,
        remaining,
        resetTime: resetTime,
      };
      this._isClientSideRateLimit = false;
    }

    if (this._rateLimitTimer) {
      clearTimeout(this._rateLimitTimer);
      this._rateLimitTimer = setTimeout(() => {
        this._rateLimit = null;
      }, this.getRateLimitSecondsUntilReset()! * 1000);
    }
  }

  /**
   * Extract rate limit information from headers (API-specific implementation)
   */
  protected extractRateLimitHeader(
    headers: HttpHeaders | undefined,
    type: 'limit' | 'remaining',
  ): number | null;
  protected extractRateLimitHeader(
    headers: HttpHeaders | undefined,
    type: 'reset',
  ): Date | null;
  protected extractRateLimitHeader(
    headers: HttpHeaders | undefined,
    type: 'limit' | 'remaining' | 'reset',
  ): number | Date | null {
    if (!headers) {
      return null;
    }

    switch (type) {
      case 'limit':
        const limitHeader = headers.get('x-ratelimit-limit');
        return limitHeader === null ? null : parseInt(limitHeader, 10);
      case 'remaining':
        const remainingHeader = headers.get('x-ratelimit-remaining');
        return remainingHeader === null ? null : parseInt(remainingHeader, 10);
      case 'reset':
        const resetHeader = headers.get('x-ratelimit-reset');
        const reset = resetHeader === null ? null : parseInt(resetHeader, 10);
        if (reset) {
          if (reset <= 2629800) {
            // If reset is a "small" number, assume it's delta-time in seconds
            return new Date(Date.now() + reset * 1000);
          } else {
            // Else assume it's a Unix timestamp
            return new Date(reset * 1000);
          }
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Client-side rate limit tracking (fallback)
   */
  private clientSideRateLimit(): void {
    // If no rate limit fallback info exists, abort
    if (this._rateLimitInfo === null) {
      return;
    }
    // Set client-side rate limit tracking flag
    this._isClientSideRateLimit = true;
    // If the rate limit is not set or has expired, reset it
    if (this._rateLimit === null || this._rateLimit.resetTime! <= new Date()) {
      this._rateLimit = { ...this._rateLimitInfo };
    }
    // Reduce the remaining count
    if (this._rateLimit.remaining > 0) {
      this._rateLimit.remaining -= 1;
    }
  }

  /**
   * Handle rate limit exceeded error
   */
  protected handleRateLimitExceeded(error: any): Observable<any> {
    if (!this._rateLimit) {
      return of({});
    }
    console.log(
      `${this.apiName} rate limit reached. Wait for ${this.getRateLimitSecondsUntilReset()} seconds.`,
    );

    // Show user notification (you can customize this)
    this.showRateLimitNotification();

    return of({ error });
  }

  /**
   * Show rate limit notification (override for custom UI)
   */
  protected async showRateLimitNotification(): Promise<void> {
    const secondsUntilReset = this.getRateLimitSecondsUntilReset()!;
    let timerInterval: NodeJS.Timeout | null = null;
    await Swal.fire({
      position: 'top-start',
      icon: 'error',
      title: 'Rate Limit Exceeded',
      html: `${this.apiName}s rate limit was reached, please try again in <b>${secondsUntilReset}</b> seconds.`,
      showConfirmButton: false,
      timer: secondsUntilReset * 1000,
      timerProgressBar: true,
      backdrop: false,
      didOpen: () => {
        const b: HTMLElement = Swal.getHtmlContainer()!.querySelector('b')!;
        timerInterval = setInterval(() => {
          b.textContent = String(Math.round(Swal.getTimerLeft()! / 1000));
        }, 100);
      },
      willClose: () => {
        if (timerInterval) {
          clearInterval(timerInterval);
        }
      },
    });
  }

  /**
   * Check if error is rate limit related (API-specific implementation)
   */
  protected isRateLimitError(error: any): boolean {
    // Check if error has rate limit properties
    return !!(error && error.status === 429);
  }
}

export interface RateLimitInfo {
  // The maximum number of requests allowed in the current period
  limit: number;
  // The number of requests remaining in the current period
  remaining: number;
  // The time when the rate limit resets
  resetTime: Date | null;
}
