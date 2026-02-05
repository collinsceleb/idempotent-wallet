# Idempotent Wallet API

A Node.js/TypeScript implementation of an idempotent wallet transfer system and daily interest accumulator.

## Features

### Part A: Idempotent Wallet Transfer
- **Idempotency Key Support**: Client-provided keys prevent duplicate transactions
- **Race Condition Prevention**: Uses PostgreSQL row-level locking (`SELECT FOR UPDATE`)
- **PENDING State**: Transactions logged before balance changes for auditability
- **Atomic Operations**: All operations within database transactions
- **Double-Entry Ledger**: Every transfer creates DEBIT and CREDIT ledger entries

### Part B: Interest Accumulator
- **Precise Math**: Uses `decimal.js` to avoid floating-point errors
- **Leap Year Handling**: Correctly uses 366 days for leap years
- **Daily Compounding**: Interest calculated and compounded daily
- **Audit Trail**: All calculations logged with full parameters

## Tech Stack

- **Framework**: NestJS
- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis (ioredis)
- **Precision Math**: decimal.js
- **Testing**: Jest with ts-jest

## Project Structure

```
src/
├── app.module.ts                   # Main application module
├── app.controller.ts               # Health check and welcome controller
├── app.service.ts                  # App-level business logic
├── main.ts                         # Application entry point
├── common/                         # Shared resources (config, redis, etc.)
├── database/                       # Database module and configuration
│   ├── migrations/                 # Database migrations
│   └── config.cjs                  # Sequelize CLI config
├── modules/
│   ├── wallet/                     # Part A: Idempotent Wallet
│   │   ├── dto/                    # Data Transfer Objects
│   │   ├── entities/               # Database models (Wallet, TransactionLog, Ledger)
│   │   ├── wallet.controller.ts    # HTTP request handlers
│   │   ├── wallet.service.ts       # Transfer logic with idempotency
│   │   └── wallet.module.ts        # Wallet module definition
│   └── interest/                   # Part B: Interest Accumulator
│       ├── dto/                    # Data Transfer Objects
│       ├── entities/               # Database models (Account, InterestLog)
│       ├── interest.controller.ts  # HTTP request handlers
│       ├── interest.service.ts     # Interest calculation logic
│       └── interest.module.ts      # Interest module definition
```

## Setup Instructions

### Prerequisites

- Node.js v18+
- PostgreSQL 14+
- Redis 6+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/collinsceleb/idempotent-wallet.git
cd idempotent-wallet

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Configure your database credentials in .env
```

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=idempotent_wallet
DB_USER=postgres
DB_PASSWORD=your_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Database Setup

```bash
# Create the database
createdb idempotent_wallet

# Run migrations
pnpm migrate
```

### Running the Application

```bash
# Development mode (with hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

## API Endpoints

### Part A: Wallet Transfer

#### Create Wallet
```http
POST /wallets
Content-Type: application/json

{
  "initialBalance": 1000.00
}
```

#### Get Wallet
```http
GET /wallets/:id
```

#### Transfer (with Idempotency)
```http
POST /wallets/transfer
Content-Type: application/json
Idempotency-Key: unique-client-generated-uuid

{
  "fromWalletId": "uuid",
  "toWalletId": "uuid",
  "amount": 100.00
}
```

**Idempotency Behavior:**
- First request: Returns `201 Created`
- Duplicate requests with same key: Returns `200 OK` with same result
- No double-spending regardless of network issues

#### Get Transaction History
```http
GET /wallets/:id/transactions
```

#### Get Ledger Entries (Double-Entry Bookkeeping)
```http
GET /wallets/:id/ledger
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "entryType": "DEBIT",
      "amount": 100.00,
      "balanceBefore": 1000.00,
      "balanceAfter": 900.00,
      "description": "Transfer to wallet xyz",
      "createdAt": "2024-02-03T12:00:00Z"
    }
  ]
}
```

### Part B: Interest Accumulator

#### Create Account
```http
POST /accounts
Content-Type: application/json

{
  "initialBalance": "10000.00000000"
}
```

#### Calculate Daily Interest
```http
POST /accounts/:id/calculate-interest
Content-Type: application/json

{
  "date": "2024-02-03"  // Optional, defaults to today
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "principalBalance": "10000.00000000",
    "interestAmount": "7.53424658",
    "annualRate": "0.275000",
    "dailyRate": "0.00075342",
    "daysInYear": 365,
    "newBalance": "10007.53424658"
  }
}
```

#### Get Interest History
```http
GET /accounts/:id/interest-history
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage report
pnpm test:coverage
```

### Test Coverage

The interest accumulator includes comprehensive tests for:
- Leap year detection (divisible by 4/100/400 rules)
- Days in year calculation (365 vs 366)
- Daily interest rate calculation
- Interest compounding accuracy
- Floating-point precision handling
- Edge cases (zero balance, large numbers)

## Architectural Decisions

### Race Condition Handling (Part A)

1. **Unique Idempotency Key**: Stored as unique constraint in `transaction_logs`
2. **Row Locking**: `SELECT ... FOR UPDATE` locks wallet rows during transfer
3. **Consistent Lock Order**: Wallets locked in ID order to prevent deadlocks
4. **PENDING State First**: TransactionLog created before any balance changes
5. **Double-Entry Ledger**: Every transfer creates matching DEBIT/CREDIT entries in `ledgers` table

### Precision Math (Part B)

1. **decimal.js**: All calculations use Decimal class, not JavaScript numbers
2. **String Storage**: DECIMAL columns stored as strings to preserve precision
3. **8 Decimal Places**: Balances support micro-unit precision
4. **Explicit Rounding**: Using `ROUND_HALF_UP` for consistent behavior

### Modular Architecture

Each module (wallet, interest) is self-contained with:
- Own models, services, controllers, routes
- Minimal shared dependencies
- Easy to extract into separate microservices
