import {
  Observable,
  of,
  MonoTypeOperatorFunction,
  defer,
  catchError,
  timer,
  mergeMap,
  throwError,
  ObservableInput,
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
    return object && !!(object as AnnotatedError).error;
  }

  /**
   * Determines if an HTTP error should be retried
   */
  private isRetryableError(error: any): boolean {
    // Retry on transient errors like network issues or rate limits
    if (this.isRateLimitError(error)) {
      return true;
    }

    // Retry on server errors (5xx) and network errors
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
    delayMs: number = 1000,
  ): MonoTypeOperatorFunction<T> {
    return (source: Observable<T>): Observable<T> => {
      return defer(() => {
        let attempt = 0;

        const handleError = (error: any): ObservableInput<T> => {
          if (this.isRetryableError(error) && attempt++ < maxRetries) {
            console.log(
              `Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms`,
            );
            return timer(delayMs).pipe(
              mergeMap(() => source.pipe(catchError(handleError))),
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
   * Create an error handler for API calls to handle rate limits and other errors.
   */
  protected createErrorHandler<T>() {
    return (error: any): Observable<T> => {
      if (this.isRateLimitError(error)) {
        return this.handleRateLimitExceeded(error);
      }

      // Handle other errors
      return of({ error } as T);
    };
  }
}

export interface AnnotatedError {
  error: {
    message: string;
    status: number;
  };
}
