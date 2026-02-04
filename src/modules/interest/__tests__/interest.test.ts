import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from 'decimal.js';
import { InterestService, ANNUAL_INTEREST_RATE } from '../services/interest.service.js';

describe('InterestService', () => {
    let service: InterestService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [InterestService],
        }).compile();

        service = module.get<InterestService>(InterestService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('isLeapYear', () => {
        test('should return true for years divisible by 4 but not by 100', () => {
            expect(service.isLeapYear(2024)).toBe(true);
            expect(service.isLeapYear(2028)).toBe(true);
            expect(service.isLeapYear(2020)).toBe(true);
        });

        test('should return false for years divisible by 100 but not by 400', () => {
            expect(service.isLeapYear(1900)).toBe(false);
            expect(service.isLeapYear(2100)).toBe(false);
            expect(service.isLeapYear(2200)).toBe(false);
        });

        test('should return true for years divisible by 400', () => {
            expect(service.isLeapYear(2000)).toBe(true);
            expect(service.isLeapYear(2400)).toBe(true);
            expect(service.isLeapYear(1600)).toBe(true);
        });

        test('should return false for non-leap years', () => {
            expect(service.isLeapYear(2023)).toBe(false);
            expect(service.isLeapYear(2025)).toBe(false);
            expect(service.isLeapYear(2021)).toBe(false);
        });
    });

    describe('getDaysInYear', () => {
        test('should return 366 for leap years', () => {
            expect(service.getDaysInYear(2024)).toBe(366);
            expect(service.getDaysInYear(2000)).toBe(366);
            expect(service.getDaysInYear(2020)).toBe(366);
        });

        test('should return 365 for non-leap years', () => {
            expect(service.getDaysInYear(2023)).toBe(365);
            expect(service.getDaysInYear(2025)).toBe(365);
            expect(service.getDaysInYear(1900)).toBe(365);
        });
    });

    describe('ANNUAL_INTEREST_RATE', () => {
        test('should equal 27.5% (0.275)', () => {
            expect(ANNUAL_INTEREST_RATE.toString()).toBe('0.275');
            expect(ANNUAL_INTEREST_RATE.toNumber()).toBe(0.275);
        });
    });

    describe('calculateDailyRate', () => {
        test('should calculate correct daily rate for non-leap year (365 days)', () => {
            const dailyRate = service.calculateDailyRate(2023);
            // 0.275 / 365 = 0.00075342465753424657...
            expect(dailyRate.toFixed(10)).toBe('0.0007534247');
        });

        test('should calculate correct daily rate for leap year (366 days)', () => {
            const dailyRate = service.calculateDailyRate(2024);
            // 0.275 / 366 = 0.00075136612021857923...
            expect(dailyRate.toFixed(10)).toBe('0.0007513661');
        });

        test('daily rate for leap year should be less than non-leap year', () => {
            const leapYearRate = service.calculateDailyRate(2024);
            const nonLeapYearRate = service.calculateDailyRate(2023);
            expect(leapYearRate.lessThan(nonLeapYearRate)).toBe(true);
        });
    });

    describe('calculateInterest', () => {
        test('should calculate interest correctly for a simple principal', () => {
            const principal = new Decimal('1000');
            const dailyRate = new Decimal('0.00075342465753424657');
            const interest = service.calculateInterest(principal, dailyRate);
            expect(interest.toFixed(8)).toBe('0.75342466');
        });

        test('should handle large principals without floating-point errors', () => {
            const principal = new Decimal('1000000.12345678');
            const dailyRate = service.calculateDailyRate(2023);
            const interest = service.calculateInterest(principal, dailyRate);
            // Result should be precise - 1000000.12345678 * 0.275/365
            expect(interest.toFixed(8)).toBe('753.42475055');
        });

        test('should return zero for zero principal', () => {
            const principal = new Decimal('0');
            const dailyRate = service.calculateDailyRate(2023);
            const interest = service.calculateInterest(principal, dailyRate);
            expect(interest.toFixed(8)).toBe('0.00000000');
        });

        test('should handle very small principals', () => {
            const principal = new Decimal('0.01');
            const dailyRate = service.calculateDailyRate(2023);
            const interest = service.calculateInterest(principal, dailyRate);
            // 0.01 * 0.00075342... = 0.0000075342...
            expect(interest.toFixed(8)).toBe('0.00000753');
        });
    });

    describe('calculateNewBalance', () => {
        test('should add interest to principal correctly', () => {
            const principal = new Decimal('1000');
            const interest = new Decimal('0.75342466');
            const newBalance = service.calculateNewBalance(principal, interest);
            expect(newBalance.toFixed(8)).toBe('1000.75342466');
        });

        test('should maintain precision with large numbers', () => {
            const principal = new Decimal('9999999.99999999');
            const interest = new Decimal('7534.24657534');
            const newBalance = service.calculateNewBalance(principal, interest);
            expect(newBalance.toFixed(8)).toBe('10007534.24657533');
        });
    });

    describe('Daily interest calculation accuracy', () => {
        test('should calculate correct interest for $10,000 over one day (non-leap year)', () => {
            // Annual rate: 27.5%
            // Daily rate: 0.275 / 365 = 0.00075342465753424657
            // Daily interest: 10000 * 0.00075342465753424657 = 7.5342465753424657
            const principal = new Decimal('10000');
            const dailyRate = service.calculateDailyRate(2023);
            const interest = service.calculateInterest(principal, dailyRate);

            expect(interest.toFixed(8)).toBe('7.53424658');
        });

        test('should calculate correct interest for $10,000 over one day (leap year)', () => {
            // Annual rate: 27.5%
            // Daily rate: 0.275 / 366 = 0.00075136612021857923
            // Daily interest: 10000 * 0.00075136612021857923 = 7.5136612021857923
            const principal = new Decimal('10000');
            const dailyRate = service.calculateDailyRate(2024);
            const interest = service.calculateInterest(principal, dailyRate);

            expect(interest.toFixed(8)).toBe('7.51366120');
        });

        test('should compound correctly over 365 days (non-leap year)', () => {
            // Starting with $10,000, after 365 days of daily compounding at 27.5% annual rate
            let balance = new Decimal('10000');
            const dailyRate = service.calculateDailyRate(2023);

            for (let day = 0; day < 365; day++) {
                const interest = service.calculateInterest(balance, dailyRate);
                balance = service.calculateNewBalance(balance, interest);
            }

            // The final balance after daily compounding for a year
            // Should be slightly more than 10000 * 1.275 = 12750 due to compounding
            expect(balance.toNumber()).toBeGreaterThan(12750);
            // With daily compounding at 27.5% the actual result
            expect(balance.toFixed(2)).toBe('13163.94');
        });

        test('should compound correctly over 366 days (leap year)', () => {
            let balance = new Decimal('10000');
            const dailyRate = service.calculateDailyRate(2024);

            for (let day = 0; day < 366; day++) {
                const interest = service.calculateInterest(balance, dailyRate);
                balance = service.calculateNewBalance(balance, interest);
            }

            // Similar to non-leap year but with one extra day of compounding
            expect(balance.toNumber()).toBeGreaterThan(12750);
            // Leap year result - slightly different due to daily rate difference
            expect(balance.toFixed(2)).toBe('13163.95');
        });
    });

    describe('Precision handling', () => {
        test('should not lose precision with floating-point edge cases', () => {
            // This tests a known floating-point issue: 0.1 + 0.2 !== 0.3 in JS
            const principal = new Decimal('0.1');
            const rate = new Decimal('0.2');
            const sum = principal.plus(rate);
            expect(sum.toString()).toBe('0.3');
        });

        test('should handle very large numbers without precision loss', () => {
            const principal = new Decimal('99999999999999.12345678');
            const dailyRate = service.calculateDailyRate(2023);
            const interest = service.calculateInterest(principal, dailyRate);
            // Should maintain precision
            expect(interest.decimalPlaces()).toBeLessThanOrEqual(20);
        });

        test('should handle currency-like precision (8 decimal places)', () => {
            const principal = new Decimal('1000.12345678');
            const dailyRate = service.calculateDailyRate(2023);
            const interest = service.calculateInterest(principal, dailyRate);
            const newBalance = service.calculateNewBalance(principal, interest);

            // Verify we can represent the result with 8 decimal places
            const fixed = newBalance.toFixed(8);
            expect(fixed).toMatch(/^\d+\.\d{8}$/);
        });
    });
});
