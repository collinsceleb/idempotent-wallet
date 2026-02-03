'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wallets', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            balance: {
                type: Sequelize.DECIMAL(20, 2),
                allowNull: false,
                defaultValue: 0.00,
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

        // Add index for faster lookups
        await queryInterface.addIndex('wallets', ['created_at']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('wallets');
    },
};
