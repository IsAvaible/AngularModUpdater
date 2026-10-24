import { fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BatchQueue } from './BatchQueue';
import { AnnotatedError } from './BaseApiProvider';

describe('BatchQueue', () => {
  it('should coalesce multiple enqueued keys into a single batch request after delay', fakeAsync(() => {
    let callCount = 0;
    let requestedKeys: string[] = [];

    const queue = new BatchQueue<string, { id: string }>(
      (keys) => {
        callCount++;
        requestedKeys = keys;
        return of({
          a: { id: 'a' },
          b: { id: 'b' }
        });
      },
      () => 100
    );

    let resA: any;
    let resB: any;
    queue.enqueue('a').subscribe((val) => (resA = val));
    queue.enqueue('b').subscribe((val) => (resB = val));

    expect(callCount).toBe(0);
    tick(100);

    expect(callCount).toBe(1);
    expect(requestedKeys).toEqual(['a', 'b']);
    expect(resA).toEqual({ id: 'a' });
    expect(resB).toEqual({ id: 'b' });
  }));

  it('should deduplicate multiple enqueue calls for the same key within a window', fakeAsync(() => {
    let callCount = 0;
    const queue = new BatchQueue<string, number>(
      (keys) => {
        callCount++;
        return of({ key1: 42 });
      },
      () => 50
    );

    let res1: any;
    let res2: any;
    queue.enqueue('key1').subscribe((val) => (res1 = val));
    queue.enqueue('key1').subscribe((val) => (res2 = val));

    tick(50);
    expect(callCount).toBe(1);
    expect(res1).toBe(42);
    expect(res2).toBe(42);
  }));

  it('should resolve missing keys to 404 AnnotatedError', fakeAsync(() => {
    const queue = new BatchQueue<string, string>(
      (keys) => of({ found: 'yes' }),
      () => 50
    );

    let resFound: any;
    let resMissing: any;
    queue.enqueue('found').subscribe((val) => (resFound = val));
    queue.enqueue('missing').subscribe((val) => (resMissing = val));

    tick(50);
    expect(resFound).toBe('yes');
    expect(resMissing).toEqual({
      error: {
        message: 'Not found: missing',
        status: 404
      }
    });
  }));

  it('should distribute a batch-level AnnotatedError to all pending keys', fakeAsync(() => {
    const batchError: AnnotatedError = {
      error: { message: 'Server unavailable', status: 503 }
    };

    const queue = new BatchQueue<string, string>(
      () => of(batchError),
      () => 50
    );

    let res1: any;
    let res2: any;
    queue.enqueue('k1').subscribe((val) => (res1 = val));
    queue.enqueue('k2').subscribe((val) => (res2 = val));

    tick(50);
    expect(res1).toEqual(batchError);
    expect(res2).toEqual(batchError);
  }));

  it('should correctly handle a key named "error" without misclassifying it as a batch error', fakeAsync(() => {
    const queue = new BatchQueue<string, { name: string }>(
      (keys) =>
        of({
          error: { name: 'Error Mod Display' }
        }),
      () => 50
    );

    let res: any;
    queue.enqueue('error').subscribe((val) => (res = val));

    tick(50);
    expect(res).toEqual({ name: 'Error Mod Display' });
  }));

  it('should gracefully handle synchronous exceptions thrown in batchFetcher', fakeAsync(() => {
    const queue = new BatchQueue<string, string>(
      () => {
        throw new Error('Immediate explosion');
      },
      () => 50
    );

    let res: any;
    queue.enqueue('k1').subscribe((val) => (res = val));

    tick(50);
    expect(res).toBeDefined();
    expect(res.error).toBeDefined();
    expect(res.error.message).toBe('Immediate explosion');
  }));

  it('should immediately flush when maxBatchSize is reached', fakeAsync(() => {
    let callCount = 0;
    const queue = new BatchQueue<number, number>(
      (keys) => {
        callCount++;
        const record: { [k: number]: number } = {};
        keys.forEach((k) => (record[k] = k * 2));
        return of(record);
      },
      () => 1000,
      3 // maxBatchSize
    );

    queue.enqueue(1);
    queue.enqueue(2);
    expect(callCount).toBe(0);

    // 3rd item hits limit and triggers flush immediately
    queue.enqueue(3);
    expect(callCount).toBe(1);

    tick(1000);
    // Timer shouldn't trigger an extra empty batch
    expect(callCount).toBe(1);
  }));
});
