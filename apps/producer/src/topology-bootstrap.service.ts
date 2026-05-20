import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitConnectionManager, RabbitTopologyService } from '@app/messaging';

@Injectable()
export class TopologyBootstrapService implements OnModuleInit {
  constructor(
    private readonly connection: RabbitConnectionManager,
    private readonly topology: RabbitTopologyService,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = await this.connection.createChannel();
    try {
      await this.topology.declare(channel);
    } finally {
      await channel.close();
    }
  }
}
