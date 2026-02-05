import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

import { Wallet } from './Wallet';
import { TransactionLog } from './TransactionLog';

export enum LedgerEntryType {
    DEBIT = 'DEBIT',
    CREDIT = 'CREDIT',
}

export interface LedgerAttributes {
    id: string;
    walletId: string;
    transactionLogId: string;
    entryType: LedgerEntryType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description?: string | null;
    createdAt?: Date;
}

export interface LedgerCreationAttributes extends Optional<LedgerAttributes, 'id' | 'description'> { }

export class Ledger extends Model<LedgerAttributes, LedgerCreationAttributes> implements LedgerAttributes {
    public id!: string;
    public walletId!: string;
    public transactionLogId!: string;
    public entryType!: LedgerEntryType;
    public amount!: number;
    public balanceBefore!: number;
    public balanceAfter!: number;
    public description!: string | null;
    public readonly createdAt!: Date;

    public wallet?: Wallet;
    public transactionLog?: TransactionLog;

    static initialize(sequelize: Sequelize) {
        Ledger.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                walletId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    field: 'wallet_id',
                    references: {
                        model: 'wallets',
                        key: 'id',
                    },
                },
                transactionLogId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    field: 'transaction_log_id',
                    references: {
                        model: 'transaction_logs',
                        key: 'id',
                    },
                },
                entryType: {
                    type: DataTypes.ENUM(...Object.values(LedgerEntryType)),
                    allowNull: false,
                    field: 'entry_type',
                },
                amount: {
                    type: DataTypes.DECIMAL(20, 2),
                    allowNull: false,
                    get() {
                        const value = this.getDataValue('amount');
                        return value === null ? 0 : parseFloat(value.toString());
                    },
                },
                balanceBefore: {
                    type: DataTypes.DECIMAL(20, 2),
                    allowNull: false,
                    field: 'balance_before',
                    get() {
                        const value = this.getDataValue('balanceBefore');
                        return value === null ? 0 : parseFloat(value.toString());
                    },
                },
                balanceAfter: {
                    type: DataTypes.DECIMAL(20, 2),
                    allowNull: false,
                    field: 'balance_after',
                    get() {
                        const value = this.getDataValue('balanceAfter');
                        return value === null ? 0 : parseFloat(value.toString());
                    },
                },
                description: {
                    type: DataTypes.STRING(255),
                    allowNull: true,
                },
            },
            {
                sequelize,
                modelName: 'Ledger',
                tableName: 'ledgers',
                timestamps: true,
                updatedAt: false, // Ledger entries are immutable
                underscored: true,
            }
        );
    }

    static associate() {
        Ledger.belongsTo(Wallet, {
            foreignKey: 'walletId',
            as: 'wallet',
        });

        Ledger.belongsTo(TransactionLog, {
            foreignKey: 'transactionLogId',
            as: 'transactionLog',
        });

        Wallet.hasMany(Ledger, {
            foreignKey: 'walletId',
            as: 'ledgerEntries',
        });

        TransactionLog.hasMany(Ledger, {
            foreignKey: 'transactionLogId',
            as: 'ledgerEntries',
        });
    }
}
