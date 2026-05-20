import { TransientError } from '../errors';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).resolves.toBe(
      'ok',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new TransientError('down'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).resolves.toBe(
      'ok',
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new TransientError('down'));
    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
