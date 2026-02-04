import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config/index';
import { connectDatabase, syncDatabase } from './database/index';
import { connectRedis } from './redis/index';

async function bootstrap() {
    // Database and Redis connections
    await connectDatabase();
    await syncDatabase();
    await connectRedis();

    const app = await NestFactory.create(AppModule);

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
    }));

    // Start server
    await app.listen(config.port);
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
