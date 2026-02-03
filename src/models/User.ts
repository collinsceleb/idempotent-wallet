import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/index.js';

interface UserAttributes {
    id: number;
    email: string;
    name: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> { }

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public id!: number;
    public email!: string;
    public name!: string;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

User.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
    }
);

export { User, UserAttributes, UserCreationAttributes };
