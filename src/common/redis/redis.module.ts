import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';

export const REDIS = 'REDIS';

@Global()
@Module({
    providers: [
        {
            provide: REDIS,
            useFactory: async (configService: ConfigService) => {
                const redisOptions: RedisOptions = {
                    host: configService.get<string>('redis.host'),
                    port: configService.get<number>('redis.port'),
                    password: configService.get<string>('redis.password') || undefined,
                    retryStrategy: (times: number) => {
                        const delay = Math.min(times * 50, 2000);
                        return delay;
                    },
                    maxRetriesPerRequest: 3,
                };

                const redis = new Redis(redisOptions);

                redis.on('connect', () => {
                    console.log('Redis connection established successfully.');
                });

                redis.on('error', (error: Error) => {
                    console.error('Redis connection error:', error.message);
                });

                return redis;
            },
            inject: [ConfigService],
        },
    ],
    exports: [REDIS],
})
export class RedisModule { }
