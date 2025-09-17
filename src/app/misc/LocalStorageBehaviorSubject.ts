import { BehaviorSubject } from 'rxjs';

/**
 * A BehaviorSubject that synchronizes its value with localStorage.
 */
export class LocalStorageBehaviorSubject<T> extends BehaviorSubject<T> {
  constructor(
    private storageKey: string,
    defaultValue: T
  ) {
    super(
      LocalStorageBehaviorSubject.getInitialValue(storageKey, defaultValue)
    );
  }

  private static getInitialValue<T>(storageKey: string, defaultValue: T): T {
    const storedValue = localStorage.getItem(storageKey);
    return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
  }

  override next(value: T): void {
    localStorage.setItem(this.storageKey, JSON.stringify(value));
    super.next(value);
  }
}
