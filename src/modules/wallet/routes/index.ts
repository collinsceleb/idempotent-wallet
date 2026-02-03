import { Router } from 'express';
import type { Router as RouterType } from 'express';
import {
    transfer,
    getWalletById,
    createNewWallet,
    getWalletTransactions,
    getWalletLedger,
} from '../controllers/index.js';

const router: RouterType = Router();

// Transfer endpoint with idempotency support
router.post('/transfer', transfer);

// Wallet management endpoints
router.post('/wallets', createNewWallet);
router.get('/wallets/:id', getWalletById);
router.get('/wallets/:id/transactions', getWalletTransactions);
router.get('/wallets/:id/ledger', getWalletLedger);

export default router;

