import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ConsumerModule } from './consumer.module';

async function bootstrap() {
  const app = await NestFactory.create(ConsumerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const port = Number(process.env.CONSUMER_PORT ?? 3002);
  await app.listen(port);
}

void bootstrap();
