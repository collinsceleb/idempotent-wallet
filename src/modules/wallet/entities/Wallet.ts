import { DataTypes, Model, Optional, Sequelize } from 'sequelize';


export interface WalletAttributes {
    id: string;
    balance: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface WalletCreationAttributes extends Optional<WalletAttributes, 'id' | 'balance'> { }

export class Wallet extends Model<WalletAttributes, WalletCreationAttributes> implements WalletAttributes {
    public id!: string;
    public balance!: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static initialize(sequelize: Sequelize) {
        Wallet.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                balance: {
                    type: DataTypes.DECIMAL(20, 2),
                    allowNull: false,
                    defaultValue: 0.00,
                    get() {
                        const value = this.getDataValue('balance');
                        return value === null ? 0 : parseFloat(value.toString());
                    },
                },
            },
            {
                sequelize,
                modelName: 'Wallet',
                tableName: 'wallets',
                timestamps: true,
                underscored: true,
            }
        );
    }
}
