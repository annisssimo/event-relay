import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitConnectionManager } from './rabbit-connection.manager';
import { RabbitTopologyService } from './rabbit-topology.service';
import { RabbitPublisherService } from './rabbit-publisher.service';
import { RabbitConsumerService } from './rabbit-consumer.service';

@Module({})
export class MessagingModule {
  static forRoot(): DynamicModule {
    return {
      module: MessagingModule,
      imports: [ConfigModule],
      providers: [
        RabbitConnectionManager,
        RabbitTopologyService,
        RabbitPublisherService,
        RabbitConsumerService,
      ],
      exports: [
        RabbitConnectionManager,
        RabbitTopologyService,
        RabbitPublisherService,
        RabbitConsumerService,
      ],
      global: true,
    };
  }
}
