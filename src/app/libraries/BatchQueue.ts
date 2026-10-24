import { AsyncSubject, Observable } from 'rxjs';
import { AnnotatedError } from './BaseApiProvider';

/**
 * Deterministic batching queue that coalesces individual key lookups into
 * batched API requests within a configurable time window.
 *
 * Guarantees:
 * - No permanent background setInterval (timer only runs while items are pending).
 * - Deduplicates concurrent requests for the same key within a window.
 * - Uses AsyncSubject so subscribers never miss an emission due to microtask/macrotask timing.
 * - Guarantees every requested key resolves to either its value or an AnnotatedError (never hangs).
 */
export class BatchQueue<K extends string | number, V> {
  private pending = new Map<K, AsyncSubject<V | AnnotatedError>>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly batchFetcher: (
      keys: K[]
    ) => Observable<{ [key in K]?: V | AnnotatedError } | AnnotatedError>,
    private readonly getDelayMs: () => number,
    private readonly maxBatchSize: number = 100
  ) {}

  /**
   * Enqueues a key to be fetched in the next batch window.
   */
  public enqueue(key: K): Observable<V | AnnotatedError> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing.asObservable();
    }

    const subject = new AsyncSubject<V | AnnotatedError>();
    this.pending.set(key, subject);

    if (this.pending.size >= this.maxBatchSize) {
      this.flush();
    } else if (this.timer === null) {
      const delay = Math.max(0, this.getDelayMs());
      this.timer = setTimeout(() => {
        this.flush();
      }, delay);
    }

    return subject.asObservable();
  }

  private isBatchAnnotatedError(res: any, keys: K[]): res is AnnotatedError {
    if (
      !res ||
      typeof res !== 'object' ||
      !('error' in res) ||
      res.error == null ||
      typeof res.error !== 'object'
    ) {
      return false;
    }
    const hasErrorProps =
      typeof res.error.status === 'number' ||
      typeof res.error.message === 'string';
    if (!hasErrorProps) {
      return false;
    }
    if (!keys.includes('error' as K)) {
      return true;
    }
    return !keys.some((k) => k !== 'error' && k in res);
  }

  /**
   * Immediately flushes all currently pending keys as a batch request.
   */
  public flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pending.size === 0) {
      return;
    }

    const currentBatch = new Map(this.pending);
    this.pending.clear();
    const keys = Array.from(currentBatch.keys());

    try {
      this.batchFetcher(keys).subscribe({
        next: (response) => {
          const isBatchError = this.isBatchAnnotatedError(response, keys);

          for (const [key, subject] of currentBatch.entries()) {
            if (isBatchError) {
              subject.next(response as AnnotatedError);
            } else {
              const record = response as { [key in K]?: V | AnnotatedError };
              const item = record ? record[key] : undefined;
              if (item !== undefined) {
                subject.next(item);
              } else {
                subject.next({
                  error: {
                    message: `Not found: ${String(key)}`,
                    status: 404
                  }
                });
              }
            }
            subject.complete();
          }
        },
        error: (err) => {
          const fallbackError: AnnotatedError = {
            error: {
              message: err?.message || 'Batch request failed',
              status: typeof err?.status === 'number' ? err.status : 500
            }
          };
          for (const subject of currentBatch.values()) {
            subject.next(fallbackError);
            subject.complete();
          }
        }
      });
    } catch (err: any) {
      const fallbackError: AnnotatedError = {
        error: {
          message: err?.message || 'Batch request failed synchronously',
          status: typeof err?.status === 'number' ? err.status : 500
        }
      };
      for (const subject of currentBatch.values()) {
        subject.next(fallbackError);
        subject.complete();
      }
    }
  }
}
