# Medical Research Platform - Backend

Production-ready backend for the Research and Studies Committee platform with MongoDB, JWT authentication, role-based access control, and Nodemailer for email notifications.

## Tech Stack

- **Node.js** + **Express**
- **MongoDB** (Mongoose)
- **JWT** (jsonwebtoken)
- **bcryptjs** for password hashing
- **Nodemailer** for emails
- **Joi** for validation

## Project Structure

```
server/
├── config/              # Configuration (DB, env)
├── controllers/         # Route handlers
├── middlewares/         # Auth, RBAC, validation, error handling
├── models/              # Mongoose models
├── routes/              # API routes
├── services/            # Email, OTP
├── validators/          # Joi schemas
├── utils/               # Helpers
├── index.js             # Entry point
├── package.json
└── .env.example
```

## Setup

1. **Install dependencies**
   ```bash
   cd server && npm install
   ```

2. **Environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `MONGODB_URI` - MongoDB connection string
   - `DB_NAME` - Database name (default: medical-research-platform)
   - `JWT_SECRET` - Strong secret for JWT signing
   - `SMTP_*` - SMTP credentials for Nodemailer (Gmail, SendGrid, etc.)

3. **Start MongoDB**
   - Local: ensure MongoDB is running
   - Or use MongoDB Atlas

4. **Run the server**
   ```bash
   npm run dev   # Development (with watch)
   npm start     # Production
   ```

## API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /signup | Public | Register |
| POST | /login | Public | Login |
| POST | /forgot-password | Public | Request password reset |
| POST | /reset-password | Public | Reset password with token |
| POST | /send-otp | Public | Send OTP email |
| POST | /verify-otp | Public | Verify OTP |
| POST | /refresh-token | Public | Refresh access token |
| GET | /me | Auth | Current user |
| POST | /logout | Auth | Logout |
| POST | /change-password | Auth | Change password |

### Submissions (`/api/submissions`)
All require authentication.
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | / | All | List submissions |
| GET | /:id | All | Get submission |
| POST | / | researcher, admin | Create |
| PUT | /:id | researcher, admin | Update |
| POST | /:id/submit | researcher, admin | Submit for review |
| POST | /:id/assign-reviewer | admin | Assign reviewer |
| PUT | /:id/review-draft | assigned reviewer, admin | Save private overall comments; admin may comment before a reviewer decision or edit an issued review |
| PATCH | /:id/field-comments | assigned reviewer, admin | Save private section comments, including before reviewer assignment |
| POST | /:id/issue-review | assigned reviewer | Issue saved review to admin |
| POST | /:id/unsubmit-review | admin | Return issued or released review for editing; hide released review from researcher |
| POST | /:id/approve-review | admin | Release issued decision and comments to researcher |
| GET | /:id/export | All | Export (placeholder) |

An admin can retrieve the currently released review until the researcher resubmits a revised proposal. Retrieval hides that decision and its comments from the researcher and restores the reviewer draft. The committee audit history retains the original release and the retrieval event. Email already delivered to the researcher cannot be recalled.

### Decision submission process

1. The researcher submits the proposal, and the PI approves the declaration (an admin may record this approval).
2. The assigned reviewer chooses a decision and saves comments. **Save review** retains a private draft; **Issue review** sends it to the administrator and locks reviewer editing.
3. The administrator may edit comments, return the review for editing, or choose **Approve and share**. Only this last action releases the decision to the researcher and triggers the outcome email. The administrator cannot change the reviewer's selected decision.
4. For revisions, the researcher edits and resubmits. The first revision deadline is 30 days; later rounds allow 7 days. The reviewer/admin process repeats.

Every released decision is recorded even with no overall comment, together with section comments and its deadline. **Decision and revision history** shows the sequence and dated submission snapshots, including document references. The original release remains in the committee audit if retrieved. New submissions and resubmissions capture immutable versions; older answers or decisions that were never stored cannot be reconstructed. Existing saved comment histories remain visible.

Approval emails identify the study title and proposal number in both the subject and body.

### Reviewers (`/api/reviewers`)
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | / | Auth | List reviewers |
| GET | /:id | Auth | Get reviewer |
| POST | / | admin | Create reviewer |
| PUT | /:id | admin | Update reviewer |
| DELETE | /:id | admin | Deactivate reviewer |

## Document upload storage and tests

Uploaded files are stored in `server/uploads` by default and served under `/api/uploads`.
Document links open in a separate tab/window. PDFs and images are served inline;
DOC/DOCX links open an escaped text preview generated locally using
[word-extractor](https://github.com/morungos/node-word-extractor), without sending documents
to an external viewer. Word text previews omit page layout, images, and tracked-change
markup, support files up to 25 MB, and have a 15-second extraction limit. A file that
cannot be previewed shows an error page instead of starting an automatic download.
For a deployment with ephemeral application storage, set `UPLOADS_DIR` to an absolute
directory on a persistent volume. Move existing uploaded files to that directory before
switching it; the database stores references, not file contents. Restarting a deployment
without persistent storage can lose uploaded files.

Run `npm test` for regression tests. For the complete browser upload test, install
Playwright (`npm install --no-save playwright` and `npx playwright install chromium`),
make `mongod` available on PATH, and run `npm run test:uploads`. Alternatively, set
`MONGOD_PATH` to its executable, `PLAYWRIGHT_MODULE_PATH` to an existing Playwright
`index.mjs`, and optionally `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome.
The test starts isolated services on ports 27029, 3002, and 5174, disables email,
and removes its temporary database and files afterward. It requires the sibling
client checkout and its installed dependencies.

## Roles

Research ethics submissions display **Awaiting PI confirmation** until the PI approves.
On submission, a PI email matching the authenticated submitter's account email
(ignoring case and surrounding spaces) is confirmed automatically; a separate PI
confirmation email is not sent. Supervisor approval remains a separate record.

Admins can use **Enable edit** / **Close edits** in the ethics submissions table
(`PATCH /api/submissions/:id/edit-access`, body `{ "enabled": true }` or `false`).
This grants correction access without changing the status, reviewer, or review draft.
While enabled, researcher responses omit overall, section, and historical review
comments, including exports. Researchers save changes rather than resubmit; closing
edits blocks subsequent saves even from an already-open form. A newly released review
restores the normal workflow permissions. Reviews cannot be released until edits are
closed. Revision reminders and automatic archiving are skipped while correction
access is enabled; existing deadlines resume when it closes.

- **researcher** - Create, edit, submit applications
- **reviewer** - Review assigned submissions
- **admin** - Manage reviewers, assign reviews, full access

## Headers

- `Authorization: Bearer <accessToken>` for protected routes

## Email Templates

Emails are sent for:
- Welcome (account creation)
- Password reset
- Password changed
- OTP verification
- Review assigned
- Submission status updates

Without SMTP config, emails are logged to console only.
