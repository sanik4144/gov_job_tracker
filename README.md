# Gov Job Tracker

Daily Telegram alerts for saved government job title keywords from AllJobs by Teletalk.

## Structure

- `backend` - Express API, MongoDB storage, Teletalk scraper, Telegram sender, scheduler
- `frontend` - React dashboard for viewing saved jobs and manually running a check

## Keywords

`JOB_KEYWORD` seeds the first keyword, currently `Assistant Programmer`. After that, keywords are managed from the frontend and saved in MongoDB. A daily check scans all active keywords, tags each saved job with its matched keyword, and sends one Telegram digest grouped by keyword.

## Deadline Reminders

Alongside the new-jobs digest, each scheduled run sends a **Closing Soon** message
listing jobs that match the user's keywords, close within `DEADLINE_REMINDER_DAYS`
(default 3), and have **not** been marked applied by that user.

- A job is reminded once per deadline. If a circular's deadline is extended, it
  earns exactly one fresh reminder.
- Marking a job applied in the dashboard stops its reminder.
- Users can switch reminders off independently of the digest, under
  **Profile - Deadline Reminders**.
- Deliveries are recorded in the `deadlinereminders` collection, keyed on
  (user, job, deadline), which is also the idempotency guard — pressing Run Scan
  twice cannot double-send.

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
