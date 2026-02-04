import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize';
import { Wallet, TransactionLog, Ledger } from '../modules/wallet/models/index';
import { Account, InterestLog } from '../modules/interest/models/index';

export const SEQUELIZE = 'SEQUELIZE';

@Global()
@Module({
    providers: [
        {
            provide: SEQUELIZE,
            useFactory: async (configService: ConfigService) => {
                const sequelize = new Sequelize({
                    dialect: 'postgres',
                    host: configService.get<string>('database.host'),
                    port: configService.get<number>('database.port'),
                    database: configService.get<string>('database.name'),
                    username: configService.get<string>('database.user'),
                    password: configService.get<string>('database.password'),
                    logging: configService.get<string>('nodeEnv') === 'development' ? console.log : false,
                    pool: {
                        max: 10,
                        min: 0,
                        acquire: 30000,
                        idle: 10000,
                    },
                });

                // Initialize models
                Wallet.initialize(sequelize);
                TransactionLog.initialize(sequelize);
                Ledger.initialize(sequelize);
                Account.initialize(sequelize);
                InterestLog.initialize(sequelize);

                // Associate models
                TransactionLog.associate();
                Ledger.associate();
                InterestLog.associate();

                // Sync database if needed (optional here, or separate script)
                // await sequelize.sync({ alter: configService.get<string>('nodeEnv') === 'development' });

                return sequelize;
            },
            inject: [ConfigService],
        },
    ],
    exports: [SEQUELIZE],
})
export class DatabaseModule { }
