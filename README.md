# Gov Job Tracker

Daily Telegram alerts for saved government job title keywords from AllJobs by Teletalk.

## Structure

- `backend` - Express API, MongoDB storage, Teletalk scraper, Telegram sender, scheduler
- `frontend` - React dashboard for viewing saved jobs and manually running a check

## Keywords

`JOB_KEYWORD` seeds the first keyword, currently `Assistant Programmer`. After that, keywords are managed from the frontend and saved in MongoDB. A daily check scans all active keywords, tags each saved job with its matched keyword, and sends one Telegram digest grouped by keyword.

## Deadline Reminders

Alongside the new-jobs digest, each scheduled run sends a **Closing Soon** message
listing jobs that match the user's keywords, are near their deadline, and have
**not** been marked applied by that user.

The rungs come from the plan: free gets the last day only, Pro gets 3 days, 1 day
and the last day (`limits.reminderStages` in `backend/src/config/plans.js`).

- A rung fires when the deadline has *reached* it, not only when it equals it, so a
  rung missed because a run failed still fires late instead of being skipped.
- Several rungs owed at once collapse into a single message.
- A job is reminded once per rung per deadline. If a circular's deadline is
  extended, the whole ladder re-arms.
- Marking a job applied in the dashboard stops its reminder.
- Users can switch reminders off independently of the digest, under
  **Profile - Deadline Reminders**.
- Deliveries are recorded in the `deadlinereminders` collection, keyed on
  (user, job, deadline, stage), which is also the idempotency guard — pressing Run Scan
  twice cannot double-send.

## Plans

| Lever | Free | Pro (BDT 99 / 30 days) |
| --- | --- | --- |
| Keywords | 2 | Unlimited |
| Digest time | Fixed 21:00 | Any time |
| Digest frequency | Daily | Daily + weekly |
| Deadline reminders | Last day only | 3 days, 1 day, last day |
| Manual Run Scan | 1/day | 10/day |

Limits live in `backend/src/config/plans.js` and are resolved by
`backend/src/services/entitlements.js`, the only module that reads `user.plan`. Every
authenticated response embeds the resolved `entitlements` inside the `user` object,
so the frontend never computes a limit itself.

A paid plan stays active while `subscriptionStatus` is live **and**
`subscriptionEndsAt` has not passed by more than `SUBSCRIPTION_GRACE_DAYS`. Grace
covers the lag between a user sending payment and an admin verifying it manually;
`canceled` is an explicit revocation and gets no grace.

### Enforcement

- Keyword count and the daily manual-scan allowance are enforced in the controllers
  that own them, and refused with **HTTP 402** carrying `code`, `feature`, `limit`
  and `upgradeTo` so the client can offer an upgrade rather than a generic error.
- Digest time, digest frequency and the reminder ladder are enforced **inside the
  notifier**, because the scheduler never passes through Express. A lapsed Pro keeps
  `weekly` and a custom time on their record and is still delivered the free
  schedule, with nothing having to rewrite their document.
- A failed scan is refunded, so a transient scrape error does not burn a free user's
  only scan of the day.

## Billing

Payment is manual bKash. The user sends money, submits the transaction ID on
`/billing`, and an admin verifies it under **Admin - Payments**.

- `Payment` is an append-only ledger; `user.plan` and `user.subscriptionEndsAt` are a
  derived cache of what it says. Admin grants go through the same ledger, so "why is
  this user Pro?" is always answerable.
- Approval extends rather than replaces:
  `subscriptionEndsAt = max(now, currentEnd) + periodDays`. Renewing early stacks the
  new period on what is left; renewing late starts from today.
- The transaction ID is unique per provider, normalized for case and spaces. That is
  the idempotency guard against a resubmitted TrxID and a double-clicked Approve.
- A submitted-but-unverified renewal holds the plan open for `PAYMENT_HOLD_DAYS`,
  but only for users with a previously approved payment - so verification lag never
  cuts off a real subscriber, and an invented TrxID buys nobody free days.
- Renewal notices ride the existing Telegram pipeline at 3 days, 1 day, expiry day
  and grace-end, keyed on `subscriptionEndsAt` so renewing re-arms the ladder.
- `npm run expire:subs` (or the daily in-process cron) marks lapsed records
  `canceled`. It is cosmetic: entitlements resolve from the date, so a run that never
  happens grants nobody access.

## Render Free Tier Note

Render free web services can sleep after inactivity. While the service is asleep, an in-process `node-cron` schedule will not run. For reliable free-tier daily alerts, use an external scheduler to call:

```txt
POST https://your-render-backend.onrender.com/api/run-daily
Header: x-cron-secret: your_CRON_SECRET
Body: {"notify":true}
```

That request wakes the Render service and runs the job check. You can use cron-job.org, GitHub Actions scheduled workflows, UptimeRobot, or a paid Render service/Render Cron Job.

## Local Setup

1. Copy `backend/.env.example` to `backend/.env` and update the values.
2. Copy `frontend/.env.example` to `frontend/.env` and update the values.
3. Install dependencies in both folders:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Deployment

### Backend on Render

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Add all backend environment variables from `backend/.env.example`

### Frontend on Vercel

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_BASE_URL` to your Render backend URL
