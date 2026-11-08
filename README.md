# FairSplit

[![CI](https://github.com/qowais38/fairsplit/actions/workflows/ci.yml/badge.svg)](https://github.com/qowais38/fairsplit/actions/workflows/ci.yml)

Shared trip expenses, clear approvals, and member-confirmed repayments - in Pakistani rupees.

FairSplit gives each member a personal dashboard and each trip a manager. Record a bill paid by one person or several contributors, approve shared expenses, settle outstanding balances, and generate a printable trip receipt.

## Features

- **Personal accounts:** signup, login, session restore, logout, and email-based password reset.
- **Trip management:** create trips, add registered members by email, or share an expiring invitation link. The creator manages that trip.
- **Multiple payers:** record each contributor's exact amount; approved expenses split equally across the current group.
- **Expense approval:** member submissions wait for the manager. Pending and rejected expenses never affect balances.
- **Personal balances:** see what you owe or should receive across all your trips, with suggested repayments.
- **Payment confirmation:** only the sender records a repayment; only the recipient confirms receipt. Managers cannot confirm for another member.
- **Trip completion:** end a trip to lock expenses and membership while members finish settling repayments.
- **Saved receipts:** generate an immutable statement with contributions, shares, payment history, and outstanding balances. Members can view a private link or print/save a PDF. Generate a new receipt after later payments.
- **Responsive design:** desktop and mobile layouts, searchable expenses, approval queues, and payment status badges.
- **Safe trip deletion:** manager-only confirmation; related records are removed together while accounts and other trips remain.

FairSplit records money sent outside the app; it does not transfer money. All amounts use PKR. Stored amounts are integer paisa, so splits remain exact.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Lucide icons |
| Backend | Node.js 24+, Express 5 |
| Database | MongoDB with transactions and unique indexes |
| Authentication | Cookie sessions, salted scrypt password hashes, hashed tokens |
| Email | Nodemailer with an optional SMTP server |
| Tests | Node test runner, MongoDB Memory Server, Playwright |

## Run locally

You need Node.js 24 or later, npm, and either MongoDB Atlas or a local MongoDB installation. MongoDB transactions require a replica set; standalone MongoDB is not supported.

The commands below use Windows PowerShell. On macOS/Linux, use `npm` in place of `npm.cmd`, and `cp` in place of `Copy-Item`.

```powershell
git clone https://github.com/qowais38/fairsplit.git
cd fairsplit
npm.cmd ci
npm.cmd --prefix server ci
npm.cmd --prefix client ci
Copy-Item server/.env.example server/.env
```

### Option A: local MongoDB

```powershell
npm.cmd --prefix server run db:start
npm.cmd run dev
```

The helper starts a separate local replica set on port **27018**, with persistent files under `server/data/mongodb`. It leaves an existing MongoDB service on port 27017 unchanged. On Windows it finds MongoDB 7.0 in its standard installation folder; otherwise put `mongod` on your PATH or set `MONGOD_BINARY` to its executable path.

The example environment file already matches this local database. Run `db:start` again after restarting your computer.

### Option B: MongoDB Atlas

Set your Atlas connection string as `MONGODB_URI` in `server/.env`, allow your machine in the cluster network settings, and then run `npm.cmd run dev`. Skip the local `db:start` command when using Atlas.

Open **http://localhost:5173**. The API runs on port **5000**. Create your account, create a trip, and add members who have registered their own accounts.

If PowerShell blocks `npm.ps1`, use `npm.cmd` as shown above; no execution-policy change is needed.

## How the workflow works

1. A user creates a trip and becomes its manager. Other members sign in through their own accounts.
2. The manager adds registered members by email or shares an invitation link.
3. A member submits an expense, including who contributed and how much. Manager-created expenses are approved immediately.
4. The manager approves or rejects the submission. Approval splits the cost equally across current members; any remaining paisa are distributed deterministically.
5. The sender pays outside FairSplit, then records the repayment. The recipient confirms it; only then do balances change. Pending payments reserve the outstanding amount to prevent duplicate repayments.
6. The manager reviews pending submissions, ends the trip, and generates a receipt. Later repayments can still be confirmed and included in a new receipt.

Only managers edit/delete approved expenses. Members can edit and resubmit their own pending/rejected submissions while a trip is active. Previously approved expenses retain their original shares when new members join. Legacy offline guest records are preserved but do not automatically link to registered accounts.

## Configuration

Copy `server/.env.example` to `server/.env`. Local settings are ignored by Git.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; default `5000`. Update the Vite proxy if you change it. |
| `APP_ORIGIN` | Browser origin for links and request checks; default `http://localhost:5173`. |
| `MONGODB_URI` | MongoDB connection string. The example uses the local helper on port 27018. |
| `MONGODB_DB` | Database name; default `fairsplit`. |
| `NODE_ENV` | Use `production` behind HTTPS; cookies then require HTTPS. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Password-reset email server; port defaults to `587`. |
| `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | SMTP credentials and sender address. |
| `MONGOD_BINARY` | Optional executable path for the local database helper. |

Password reset needs a configured SMTP server. Reset links expire after 30 minutes, are single-use, and revoke existing sessions after a successful reset. Tests inject an email sender and never send real email.

## Commands and checks

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the frontend and API in development mode |
| `npm.cmd run build` | Build the frontend |
| `npm.cmd start` | Serve the built frontend and API together |
| `npm.cmd test` | Run API integration tests with an isolated MongoDB replica set |
| `npm.cmd run test:e2e` | Run browser flows against the built app |
| `npm.cmd --prefix server run db:start` | Start the persistent local MongoDB instance |

Build before running browser tests. Tests never use your application database. MongoDB Memory Server downloads a test binary on its first run unless a suitable local binary is found. `MONGOMS_SYSTEM_BINARY` and `MONGOMS_VERSION` can override the test binary.

Browser tests use installed Chrome by default. Set `BROWSER_CHANNEL=msedge` for Edge, or install bundled Chromium with `npx playwright install chromium` and set `BROWSER_CHANNEL=chromium`.

GitHub Actions installs dependencies, builds the frontend, runs the API tests, and checks the manager/member browser flows on every push or pull request to `main`.

## Production

```powershell
npm.cmd run build
npm.cmd start
```

Set `APP_ORIGIN` to your public HTTPS origin, `NODE_ENV=production`, and `MONGODB_URI` to your persistent MongoDB deployment. Put the Node server behind an HTTPS reverse proxy. This implementation is intended for one application instance; authentication throttling is held in process memory.

For a built-app local preview at http://localhost:5000, use `APP_ORIGIN=http://localhost:5000` and leave `NODE_ENV` unset.

Keep `.env`, database backups, and live receipts out of the repository. Passwords use salted scrypt hashes; session, reset, and invitation tokens are stored as SHA-256 digests. Sessions expire after seven days and use HttpOnly/SameSite cookies. Trip operations check membership and manager permissions on the server.

## Project layout

```text
client/src/       React pages, trip/expense forms, account dashboards, and styles
server/src/       API, MongoDB access, and receipt rendering
server/scripts/   Local MongoDB startup and optional legacy-data import
server/test/      API integration tests and isolated MongoDB setup
test/            Browser integration tests
scripts/         Development launcher
docs/API.md      API reference
```

See the [API reference](docs/API.md) for endpoints and request conventions.

## Optional: import an old SQLite database

Stop the app and configure an empty MongoDB database in `server/.env`, then run:

```powershell
npm.cmd --prefix server run migrate:sqlite
```

To use a different source file, append `-- path/to/fairsplit.sqlite`. The import preserves accounts, password hashes, sessions, trips, memberships, expenses, repayments, and invitations in one transaction. It refuses a nonempty target and leaves the original SQLite file unchanged. The running application uses MongoDB only.
