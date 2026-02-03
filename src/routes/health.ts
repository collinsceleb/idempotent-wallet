import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { redis } from '../redis/index.js';

const router: RouterType = Router();

router.get('/health', async (_req: Request, res: Response) => {
    try {
        // Check Redis connection
        const redisStatus = redis.status === 'ready' ? 'connected' : 'disconnected';

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                redis: redisStatus,
            },
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
