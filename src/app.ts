import express, { Application, Request, Response, NextFunction } from 'express';
import { config } from './config/index.js';
import { connectDatabase, syncDatabase } from './database/index.js';
import { connectRedis, disconnectRedis } from './redis/index.js';
import { healthRouter } from './routes/index.js';
import { walletRoutes } from './modules/wallet/index.js';
import { interestRoutes } from './modules/interest/index.js';

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', healthRouter);
app.use('/api/wallet', walletRoutes);
app.use('/api/interest', interestRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
    res.json({
        message: 'Welcome to Idempotent Wallet API',
        version: '1.0.0',
    });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal Server Error',
        message: config.nodeEnv === 'development' ? err.message : undefined,
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

async function startServer(): Promise<void> {
    try {
        // Connect to PostgreSQL
        await connectDatabase();
        await syncDatabase();

        // Connect to Redis
        await connectRedis();

        // Start server
        app.listen(config.port, () => {
            console.log(`Server running on http://localhost:${config.port}`);
            console.log(`Environment: ${config.nodeEnv}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await disconnectRedis();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await disconnectRedis();
    process.exit(0);
});

startServer();

export { app };
