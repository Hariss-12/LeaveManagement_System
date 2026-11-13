# Leave Management System

A lightweight Express + MongoDB leave management app with a simple vanilla JavaScript frontend.

## Local development

Use Node.js 22 or newer. Copy `.env.example` to `.env`, then set these values:

- `MONGODB_URI`: a MongoDB Atlas or local MongoDB connection string.
- `AUTH_SECRET`: a private random string with at least 32 characters.
- `WARDEN_USERNAME` and `WARDEN_PASSWORD`: the warden sign-in credentials.
- `PORT` is optional; Render provides it automatically.

Run `npm install`, then `npm start` or `npm run dev`. The app serves the UI and API at `http://localhost:5050`.

Do not commit `.env` or share its values.

## Deploy on Render

Create a Render Web Service from this repository with the project folder as its root, `npm install` as the build command, and `npm start` as the start command.

Set `MONGODB_URI`, `AUTH_SECRET`, `WARDEN_USERNAME`, and `WARDEN_PASSWORD` in the Render service's Environment settings. In MongoDB Atlas, allow the Render service's outbound IP ranges in the cluster's network access list.

The GitHub Actions workflow runs lint and API tests on pushes and pull requests. To trigger Render through the workflow, add `RENDER_DEPLOY_HOOK_URL` as a repository secret. If the secret is not set, the hook is skipped; enable Render's GitHub auto-deploy if you want Render to deploy without the hook.

## Scripts

- `npm run lint`: check JavaScript.
- `npm test`: run API checks against `TEST_MONGODB_URI`, or the local `leave-management-test` database by default. The test removes its test user.
