# Leave Management System

An Express and MongoDB leave management application with a browser frontend.

## Local development

Use Node.js 22 or newer. Copy `.env.example` to `.env`, then set these values:

- `MONGODB_URI`: a MongoDB Atlas connection string (`mongodb+srv://...`).
- `AUTH_SECRET`: a private random string with at least 32 characters.
- `WARDEN_USERNAME` and `WARDEN_PASSWORD`: the warden sign-in credentials.
- `PORT` is optional; Render provides it automatically.

Run `npm install`, then `npm start`. The Express server serves the app at
`http://localhost:5050`. Do not commit `.env` or share its values.

For Vite development, run `npm run dev` in another terminal and open the URL it
prints. Requests to `/api` are proxied to the Express server on port 5050.

## Deploy on Render

Create a Render Web Service from this repository with the project folder as its
root, `npm install` as the build command, and `npm start` as the start command.
Set `MONGODB_URI`, `AUTH_SECRET`, `WARDEN_USERNAME`, and `WARDEN_PASSWORD` in the
Render service's Environment settings. In MongoDB Atlas, allow the Render
service's outbound IP ranges in the cluster's network access list.

The GitHub Actions workflow builds the frontend on pushes to `main`. To deploy
through a Render deploy hook, add `RENDER_DEPLOY_HOOK_URL` as a GitHub Actions
repository secret. If the Render service is already connected to GitHub with
auto-deploy enabled, the hook secret is optional.

## Scripts

- `npm run build`: build frontend assets into `dist`.
- `npm run lint`: check JavaScript.
- `npm test`: run API checks against `TEST_MONGODB_URI`, or the local
  `leave-management-test` database by default. The test removes its test user.
