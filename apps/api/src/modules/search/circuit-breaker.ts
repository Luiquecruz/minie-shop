export type CircuitState = 'closed' | 'open' | 'half_open';

export class SimpleCircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly resetTimeoutMs = 15_000,
  ) {}

  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.resetTimeoutMs) {
        this.state = 'half_open';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.openedAt = 0;
  }
}
