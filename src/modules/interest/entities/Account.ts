import { DataTypes, Model, Optional, Sequelize } from 'sequelize';


export interface AccountAttributes {
    id: string;
    balance: string; // Use string for DECIMAL precision
    createdAt?: Date;
    updatedAt?: Date;
}

export interface AccountCreationAttributes extends Optional<AccountAttributes, 'id' | 'balance'> { }

export class Account extends Model<AccountAttributes, AccountCreationAttributes> implements AccountAttributes {
    public id!: string;
    public balance!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static initialize(sequelize: Sequelize) {
        Account.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                balance: {
                    type: DataTypes.DECIMAL(20, 2),
                    allowNull: false,
                    defaultValue: '0.00',
                },
            },
            {
                sequelize,
                modelName: 'Account',
                tableName: 'accounts',
                timestamps: true,
                underscored: true,
            }
        );
    }
}

