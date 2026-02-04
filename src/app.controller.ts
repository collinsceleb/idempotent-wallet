import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService
    ) { }
    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('health')
    healthCheck(@Res() res: Response): void {
        const health = this.appService.getHealth();
        const httpStatus = health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

        res.status(httpStatus).json({
            status: health.status,
            timestamp: new Date().toISOString(),
            services: {
                redis: health.redisStatus,
            },
        });
    }
}
