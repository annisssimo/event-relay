import { hashPayload } from './hash-payload';

describe('hashPayload', () => {
  it('produces stable hash for same payload', () => {
    const a = hashPayload({ id: 1 });
    const b = hashPayload({ id: 1 });
    expect(a).toBe(b);
  });

  it('differs for different payloads', () => {
    expect(hashPayload({ id: 1 })).not.toBe(hashPayload({ id: 2 }));
  });
});
