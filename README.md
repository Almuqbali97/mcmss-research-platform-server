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
| POST | /:id/review | reviewer | Submit review |
| GET | /:id/export | All | Export (placeholder) |

### Reviewers (`/api/reviewers`)
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | / | Auth | List reviewers |
| GET | /:id | Auth | Get reviewer |
| POST | / | admin | Create reviewer |
| PUT | /:id | admin | Update reviewer |
| DELETE | /:id | admin | Deactivate reviewer |

## Roles

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
