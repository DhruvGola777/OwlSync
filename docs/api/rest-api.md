# REST API Specifications & Reference
## OwlSync Core REST API (Port 4000)

Interactive Swagger UI documentation is available at:
`http://localhost:4000/api-docs` or `http://localhost:4000/docs`

---

## 1. Authentication Endpoints (`/api/auth`)
- `POST /api/auth/register` — Register new user account.
- `POST /api/auth/login` — Authenticate and receive JWT cookie & refresh token.
- `POST /api/auth/logout` — Invalidate sessions and clear auth cookies.
- `POST /api/auth/refresh` — Issue refreshed JWT using valid refresh token.
- `POST /api/auth/magic-link/request` — Request passwordless magic login email.
- `GET /api/auth/magic-link/verify` — Validate magic token and log in.

---

## 2. Projects & File System (`/api/projects`)
- `GET /api/projects` — Fetch all projects for the authenticated user.
- `POST /api/projects` — Create blank or template project.
- `GET /api/projects/:id` — Get project details, files, notes, and whiteboard.
- `POST /api/projects/import/zip` — Upload `.zip` archive to unpack into a project.
- `POST /api/projects/import/folder` — Recursive directory import from browser.
- `POST /api/projects/:id/files` — Create file or folder inside project.
- `PUT /api/projects/:id/files/:fileId` — Save file contents.
- `PUT /api/projects/:id/files/rename` — Rename file or directory.
- `DELETE /api/projects/:id/files` — Delete file or directory path.
- `GET /api/projects/:id/export` — Export project archive as downloadable `.zip`.

---

## 3. Rooms & Live Collaboration (`/api/rooms`)
- `GET /api/rooms` — List public collaboration rooms.
- `POST /api/rooms` — Create password-protected or public room.
- `GET /api/rooms/:id` — Fetch room details and active participants.
- `POST /api/rooms/join` — Join room with optional password.
- `POST /api/rooms/:id/leave` — Leave active room.
- `DELETE /api/rooms/:id` — Delete room (Owner only).

---

## 4. Teams & Organizations (`/api/teams`)
- `GET /api/teams` — List user's organizations and team memberships.
- `POST /api/teams` — Create organization workspace.
- `GET /api/teams/:id` — Get organization details, members, and team projects.
- `POST /api/teams/:id/members` — Add member with `MEMBER` or `ADMIN` role.
- `DELETE /api/teams/:id/members/:userId` — Remove member from team.
- `DELETE /api/teams/:id` — Delete organization (Owner only).

---

## 5. Global Search & Notifications
- `GET /api/search?q={query}` — Search across rooms, projects, files, and users.
- `GET /api/notifications` — Fetch recent user notifications.
- `PATCH /api/notifications/:id/read` — Mark notification as read.
- `PATCH /api/notifications/read-all` — Mark all notifications as read.
- `DELETE /api/notifications/:id` — Delete notification.

---

## 6. AI Assistant (`/api/ai`)
- `POST /api/ai/chat` — Conversational AI pair programming.
- `POST /api/ai/explain` — Explain selected code block.
- `POST /api/ai/refactor` — Suggest refactored implementation.
- `POST /api/ai/generate-tests` — Generate automated unit test suite.
- `POST /api/ai/detect-bugs` — Static and semantic bug analysis.
- `POST /api/ai/commit-message` — Generate Git-ready conventional commit message.
- `POST /api/ai/agent/stream` — Full Server-Sent Events (SSE) AI coding stream.
