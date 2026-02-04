import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS } from './common/redis/index';

export interface HealthStatus {
    status: 'ok' | 'error';
    redisStatus: 'connected' | 'disconnected';
}

@Injectable()
export class AppService {
    constructor(
        @Inject(REDIS)
        private readonly redis: Redis
    ) { }

    getHello(): string {
        return 'Welcome to Idempotent Wallet API';
    }

    getHealth(): HealthStatus {
        const redisStatus = this.redis.status === 'ready' ? 'connected' : 'disconnected';
        const status = redisStatus === 'connected' ? 'ok' : 'error';

        return {
            status,
            redisStatus
        };
    }
}
