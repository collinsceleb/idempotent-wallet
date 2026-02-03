'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('interest_logs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            account_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'accounts',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            calculation_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            principal_balance: {
                type: Sequelize.DECIMAL(20, 8),
                allowNull: false,
            },
            interest_amount: {
                type: Sequelize.DECIMAL(20, 8),
                allowNull: false,
            },
            annual_rate: {
                type: Sequelize.DECIMAL(10, 6),
                allowNull: false,
            },
            days_in_year: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            new_balance: {
                type: Sequelize.DECIMAL(20, 8),
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Unique constraint: one interest calculation per account per day
        await queryInterface.addIndex('interest_logs', ['account_id', 'calculation_date'], {
            unique: true,
            name: 'interest_logs_account_date_unique',
        });

        await queryInterface.addIndex('interest_logs', ['account_id']);
        await queryInterface.addIndex('interest_logs', ['calculation_date']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('interest_logs');
    },
};
