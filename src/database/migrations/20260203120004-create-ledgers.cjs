'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('ledgers', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            wallet_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'wallets',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            transaction_log_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'transaction_logs',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            entry_type: {
                type: Sequelize.ENUM('DEBIT', 'CREDIT'),
                allowNull: false,
            },
            amount: {
                type: Sequelize.DECIMAL(20, 2),
                allowNull: false,
            },
            balance_before: {
                type: Sequelize.DECIMAL(20, 2),
                allowNull: false,
            },
            balance_after: {
                type: Sequelize.DECIMAL(20, 2),
                allowNull: false,
            },
            description: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Indexes for efficient queries
        await queryInterface.addIndex('ledgers', ['wallet_id']);
        await queryInterface.addIndex('ledgers', ['transaction_log_id']);
        await queryInterface.addIndex('ledgers', ['entry_type']);
        await queryInterface.addIndex('ledgers', ['created_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('ledgers');
    },
};
