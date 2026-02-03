import { Sequelize } from 'sequelize';
import { config } from '../config/index.js';

export const sequelize = new Sequelize({
    dialect: 'postgres',
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    username: config.database.user,
    password: config.database.password,
    logging: config.nodeEnv === 'development' ? console.log : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});

export async function connectDatabase(): Promise<void> {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
    } catch (error) {
        console.error('Unable to connect to database:', error);
        throw error;
    }
}

export async function syncDatabase(): Promise<void> {
    try {
        await sequelize.sync({ alter: config.nodeEnv === 'development' });
        console.log('Database synchronized successfully.');
    } catch (error) {
        console.error('Unable to sync database:', error);
        throw error;
    }
}
