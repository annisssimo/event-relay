import { ConfigService } from '@nestjs/config';
import { RabbitConnectionManager } from './rabbit-connection.manager';

describe('RabbitConnectionManager', () => {
  it('registers and unregisters reconnect listeners', () => {
    const manager = new RabbitConnectionManager({
      get: jest.fn().mockReturnValue('1000'),
    } as unknown as ConfigService);

    const listener = jest.fn();
    const unsubscribe = manager.onReconnect(listener);

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });
});
