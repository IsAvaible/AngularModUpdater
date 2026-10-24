import {
  Observable,
  of,
  MonoTypeOperatorFunction,
  defer,
  catchError,
  timer,
  mergeMap,
  throwError,
  ObservableInput
} from 'rxjs';

import { RateLimitedApi } from './RateLimitedApi';

// ===== BASE API PROVIDER =====
export abstract class BaseApiProvider extends RateLimitedApi {
  protected abstract override apiName: string;

  /**
   * Checks if the given object is an annotated error
   * @param object The object to check
   */
  public isAnnotatedError(object: any): object is AnnotatedError {
    return Boolean(
      object &&
      typeof object === 'object' &&
      'error' in object &&
      object.error != null
    );
  }

  /**
   * Determines if an HTTP error should be retried
   */
  protected isRetryableError(error: any): boolean {
    if (!error) {
      return false;
    }

    // Retry on transient errors like network issues or rate limits
    if (this.isRateLimitError(error)) {
      return true;
    }

    // Retry on RxJS TimeoutError
    if (error.name === 'TimeoutError') {
      return true;
    }

    // Retry on server errors (5xx) and network errors (status 0)
    if (error.status >= 500 || error.status === 0) {
      return true;
    }

    return false;
  }

  /**
   * Retries the request with a backoff strategy
   * @param maxRetries The maximum number of retries
   * @param delayMs The delay in milliseconds
   * @private
   */
  protected createRetryStrategy<T>(
    maxRetries: number = 3,
    delayMs: number = 1000
  ): MonoTypeOperatorFunction<T> {
    return (source: Observable<T>): Observable<T> => {
      return defer(() => {
        let attempt = 0;

        const handleError = (error: any): ObservableInput<T> => {
          if (this.isRetryableError(error) && attempt++ < maxRetries) {
            let backoffMs = delayMs * Math.pow(2, attempt - 1);
            if (this.isRateLimitError(error)) {
              this.trackRateLimit(error?.headers);
              const resetSec = this.getRateLimitSecondsUntilReset();
              if (resetSec && resetSec > 0) {
                // Cap the backoff wait at 60 seconds during retries
                backoffMs = Math.min(
                  60000,
                  Math.max(backoffMs, resetSec * 1000)
                );
              }
            }
            backoffMs += Math.floor(Math.random() * 200);

            console.log(
              `Retry attempt ${attempt}/${maxRetries} after ${Math.round(backoffMs)}ms`
            );
            return timer(backoffMs).pipe(
              mergeMap(() => source.pipe(catchError(handleError)))
            );
          } else {
            console.error(`Max retries (${maxRetries}) exceeded`);
            return throwError(() => error);
          }
        };

        return source.pipe(catchError(handleError));
      });
    };
  }

  /**
   * Creates a batch error handler that records rate limits (if applicable) and maps
   * all requested keys to an AnnotatedError.
   */
  protected createBatchErrorHandler<K extends string | number, V>(
    keys: K[],
    defaultMessage: string
  ) {
    return (error: any): Observable<{ [key in K]: V | AnnotatedError }> => {
      if (this.isRateLimitError(error)) {
        this.recordRateLimitAndNotify(error);
      }
      const status =
        typeof error?.status === 'number'
          ? error.status
          : error?.name === 'TimeoutError'
            ? 408
            : 500;
      const message = error?.message || defaultMessage;
      const errObj: AnnotatedError = { error: { message, status } };
      const result: { [key in K]: V | AnnotatedError } = {} as any;
      keys.forEach((key) => {
        result[key] = errObj;
      });
      return of(result);
    };
  }

  /**
   * Create an error handler for API calls to handle rate limits and other errors.
   */
  protected createErrorHandler<T>() {
    return (error: any): Observable<T> => {
      if (this.isRateLimitError(error)) {
        return this.handleRateLimitExceeded(error);
      }

      // Normalize into AnnotatedError structure
      const annotated: AnnotatedError = {
        error: {
          message: error?.message || error?.statusText || 'Request failed',
          status:
            typeof error?.status === 'number'
              ? error.status
              : error?.name === 'TimeoutError'
                ? 408
                : 500
        }
      };
      return of(annotated as unknown as T);
    };
  }
}

export interface AnnotatedError {
  error: {
    message: string;
    status: number;
  };
}
