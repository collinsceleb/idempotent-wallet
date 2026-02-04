import { Router } from 'express';
import type { Router as RouterType } from 'express';
import {
    createNewAccount,
    getAccountById,
    calculateInterest,
    getAccountInterestHistory,
} from '../controllers/account.controller.js';

const router: RouterType = Router();

// Account management
router.post('/accounts', createNewAccount);
router.get('/accounts/:id', getAccountById);

// Interest calculation
router.post('/accounts/:id/calculate-interest', calculateInterest);
router.get('/accounts/:id/interest-history', getAccountInterestHistory);

export default router;
