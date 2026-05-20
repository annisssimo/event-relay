import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitConnectionManager, RabbitTopologyService } from '@app/messaging';

@Injectable()
export class TopologyBootstrapService implements OnModuleInit {
  private readonly ready: Promise<void>;
  private resolveReady!: () => void;

  constructor(
    private readonly connection: RabbitConnectionManager,
    private readonly topology: RabbitTopologyService,
  ) {
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  async onModuleInit(): Promise<void> {
    const channel = await this.connection.createChannel();
    try {
      await this.topology.declare(channel);
    } finally {
      await channel.close();
    }
    this.resolveReady();
  }
}
