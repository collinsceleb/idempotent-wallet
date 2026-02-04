import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { redis } from './redis/index';

@Controller()
export class AppController {
    @Get()
    getHello(): string {
        return 'Welcome to Idempotent Wallet API';
    }

    @Get('health')
    healthCheck(@Res() res: Response): void {
        const redisStatus = redis.status === 'ready' ? 'connected' : 'disconnected';
        const status = redisStatus === 'connected' ? 'ok' : 'error';
        const httpStatus = redisStatus === 'connected' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

        res.status(httpStatus).json({
            status,
            timestamp: new Date().toISOString(),
            services: {
                redis: redisStatus,
            },
        });
    }
}
