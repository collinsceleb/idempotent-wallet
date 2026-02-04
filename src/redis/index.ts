import { Redis, RedisOptions } from 'ioredis';
import { config } from '../config/index';

const redisOptions: RedisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
};

export const redis = new Redis(redisOptions);

redis.on('connect', () => {
    console.log('Redis connection established successfully.');
});

redis.on('error', (error: Error) => {
    console.error('Redis connection error:', error.message);
});

redis.on('reconnecting', () => {
    console.log('Redis reconnecting...');
});

export async function connectRedis(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (redis.status === 'ready') {
            resolve();
            return;
        }

        redis.once('ready', () => {
            resolve();
        });

        redis.once('error', (error: Error) => {
            reject(error);
        });
    });
}

export async function disconnectRedis(): Promise<void> {
    await redis.quit();
    console.log('Redis connection closed.');
}
