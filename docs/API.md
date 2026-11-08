# FairSplit API

JSON requests and cookie authentication are used throughout. Errors return `{ "error": "message" }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout` | Account/session actions |
| GET | `/api/auth/me` | Current account |
| POST | `/api/auth/forgot`, `/api/auth/reset` | Password recovery |
| GET | `/api/users/lookup?email=…` | Find an exact registered email (authenticated; returns only ID, name and email) |
| POST | `/api/trips/:id/complete` | Manager ends a trip; pending expense reviews must be resolved first |
| POST | `/api/trips/:id/receipts` | Manager creates a saved receipt for a completed trip |
| GET | `/api/trips/:id/receipts/:receiptId` | Member-only printable/shareable receipt; signed-out viewers return here after login |
| DELETE | `/api/trips/:id` | Manager permanently deletes a trip and its related records |
| POST | `/api/trips/:id/members` | Manager adds registered `memberIds` |
| POST | `/api/trips/:id/expenses/:expenseId/review` | Manager approves/rejects pending expense with `decision` and current `version` |
| GET | `/api/state` | Current user's trips, members and ledgers |
| POST | `/api/trips` | Create trip with `name`, `location`, dates, `memberIds` and legacy `guestNames` |
| POST | `/api/trips/:id/invites` | Create/rotate invite |
| POST | `/api/invites/join` | Join with invitation `token` |
| POST | `/api/trips/:id/expenses` | Add expense |
| PUT | `/api/trips/:id/expenses/:expenseId` | Edit expense, including its current `version` |
| DELETE | `/api/trips/:id/expenses/:expenseId` | Delete expense |
| POST | `/api/trips/:id/settlements` | Record repayment with `from`, `to`, integer-cent `amount` |
| POST | `/api/trips/:id/settlements/:paymentId/confirm` | Confirm receipt |
| POST | `/api/trips/:id/settlements/:paymentId/cancel` | Cancel pending repayment |

The signed-in user's member ID is represented as `you` in API views and accepted in expense/payment requests. Other members retain their stable IDs.
