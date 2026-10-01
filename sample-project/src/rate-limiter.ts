export class RateLimiter {
  private readonly limit: number;
  private readonly windowMilliseconds: number;
  private readonly timestampsByKey = new Map<string, number[]>();

  public constructor(limit: number, windowMilliseconds: number) {
    this.limit = limit;
    this.windowMilliseconds = windowMilliseconds;
  }

  public tryAcquire(key: string, now: number = Date.now()): boolean {
    const windowStart = now - this.windowMilliseconds;
    const recent = (this.timestampsByKey.get(key) ?? []).filter(
      (timestamp: number) => timestamp > windowStart
    );

    if (recent.length >= this.limit) {
      this.timestampsByKey.set(key, recent);
      return false;
    }

    recent.push(now);
    this.timestampsByKey.set(key, recent);

    return true;
  }
}
