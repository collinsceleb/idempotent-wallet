'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('transaction_logs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            idempotency_key: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true,
            },
            from_wallet_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'wallets',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            to_wallet_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'wallets',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            amount: {
                type: Sequelize.DECIMAL(20, 2),
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM('PENDING', 'COMPLETED', 'FAILED'),
                allowNull: false,
                defaultValue: 'PENDING',
            },
            error_message: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Add indexes for faster lookups
        await queryInterface.addIndex('transaction_logs', ['idempotency_key']);
        await queryInterface.addIndex('transaction_logs', ['from_wallet_id']);
        await queryInterface.addIndex('transaction_logs', ['to_wallet_id']);
        await queryInterface.addIndex('transaction_logs', ['status']);
        await queryInterface.addIndex('transaction_logs', ['created_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('transaction_logs');
    },
};
