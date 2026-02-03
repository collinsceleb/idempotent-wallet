import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
    nodeEnv: string;
    database: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
    };
    redis: {
        host: string;
        port: number;
        password: string;
    };
}

export const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'idempotent_wallet',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
    },
};
