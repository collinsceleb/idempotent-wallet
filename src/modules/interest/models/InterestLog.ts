import { DataTypes, Model, Optional } from 'sequelize';

import { Account } from './Account';

export interface InterestLogAttributes {
    id: string;
    accountId: string;
    calculationDate: string; // DATEONLY stored as string
    principalBalance: string;
    interestAmount: string;
    annualRate: string;
    daysInYear: number;
    newBalance: string;
    createdAt?: Date;
}

export interface InterestLogCreationAttributes extends Optional<InterestLogAttributes, 'id'> { }

export class InterestLog
    extends Model<InterestLogAttributes, InterestLogCreationAttributes>
    implements InterestLogAttributes {
    public id!: string;
    public accountId!: string;
    public calculationDate!: string;
    public principalBalance!: string;
    public interestAmount!: string;
    public annualRate!: string;
    public daysInYear!: number;
    public newBalance!: string;
    public readonly createdAt!: Date;

    // Associations
    // Associations
    public account?: Account;

    static initialize(sequelize: any) {
        InterestLog.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                accountId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    field: 'account_id',
                    references: {
                        model: 'accounts',
                        key: 'id',
                    },
                },
                calculationDate: {
                    type: DataTypes.DATEONLY,
                    allowNull: false,
                    field: 'calculation_date',
                },
                principalBalance: {
                    type: DataTypes.DECIMAL(20, 8),
                    allowNull: false,
                    field: 'principal_balance',
                },
                interestAmount: {
                    type: DataTypes.DECIMAL(20, 8),
                    allowNull: false,
                    field: 'interest_amount',
                },
                annualRate: {
                    type: DataTypes.DECIMAL(10, 6),
                    allowNull: false,
                    field: 'annual_rate',
                },
                daysInYear: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    field: 'days_in_year',
                },
                newBalance: {
                    type: DataTypes.DECIMAL(20, 8),
                    allowNull: false,
                    field: 'new_balance',
                },
            },
            {
                sequelize,
                modelName: 'InterestLog',
                tableName: 'interest_logs',
                timestamps: true,
                updatedAt: false, // Interest logs are immutable
                underscored: true,
            }
        );
    }

    static associate() {
        InterestLog.belongsTo(Account, {
            foreignKey: 'accountId',
            as: 'account',
        });

        Account.hasMany(InterestLog, {
            foreignKey: 'accountId',
            as: 'interestLogs',
        });
    }
}
