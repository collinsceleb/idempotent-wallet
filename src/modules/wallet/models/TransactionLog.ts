import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../database/index.js';
import { Wallet } from './Wallet.js';

export enum TransactionStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface TransactionLogAttributes {
    id: string;
    idempotencyKey: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    status: TransactionStatus;
    errorMessage?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TransactionLogCreationAttributes
    extends Optional<TransactionLogAttributes, 'id' | 'status' | 'errorMessage'> { }

export class TransactionLog
    extends Model<TransactionLogAttributes, TransactionLogCreationAttributes>
    implements TransactionLogAttributes {
    public id!: string;
    public idempotencyKey!: string;
    public fromWalletId!: string;
    public toWalletId!: string;
    public amount!: number;
    public status!: TransactionStatus;
    public errorMessage!: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Associations
    public fromWallet?: Wallet;
    public toWallet?: Wallet;
}

TransactionLog.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        idempotencyKey: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            field: 'idempotency_key',
        },
        fromWalletId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'from_wallet_id',
            references: {
                model: 'wallets',
                key: 'id',
            },
        },
        toWalletId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'to_wallet_id',
            references: {
                model: 'wallets',
                key: 'id',
            },
        },
        amount: {
            type: DataTypes.DECIMAL(20, 2),
            allowNull: false,
            get() {
                const value = this.getDataValue('amount');
                return value === null ? 0 : parseFloat(value.toString());
            },
        },
        status: {
            type: DataTypes.ENUM(...Object.values(TransactionStatus)),
            allowNull: false,
            defaultValue: TransactionStatus.PENDING,
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'error_message',
        },
    },
    {
        sequelize,
        modelName: 'TransactionLog',
        tableName: 'transaction_logs',
        timestamps: true,
        underscored: true,
    }
);

// Define associations
TransactionLog.belongsTo(Wallet, {
    foreignKey: 'fromWalletId',
    as: 'fromWallet',
});

TransactionLog.belongsTo(Wallet, {
    foreignKey: 'toWalletId',
    as: 'toWallet',
});

Wallet.hasMany(TransactionLog, {
    foreignKey: 'fromWalletId',
    as: 'outgoingTransactions',
});

Wallet.hasMany(TransactionLog, {
    foreignKey: 'toWalletId',
    as: 'incomingTransactions',
});
