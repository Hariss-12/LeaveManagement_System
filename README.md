# Leave Management System

Express and MongoDB application with a browser frontend.

## Run

From this directory, run `npm install` if dependencies are missing, then `npm start`.
Open http://localhost:5050. MongoDB must be running on port 27017.
The server prints `MongoDB connected successfully` followed by
`Server running at http://localhost:5050` when ready.

Optionally set `MONGODB_URI` and `PORT` to use another database or server port.

Create a user with initial leave balances, log in using the same email, and apply
for leave. For example, starting with 10 casual days and applying for 3 leaves
7 casual days. Requests exceeding the available balance are rejected.
Initial balances default to zero if omitted.

## Development and checks

- `npm run dev`: Vite frontend; run `npm start` in another terminal for the API.
- `npm run build`: build frontend files into `dist`.
- `npm run preview`: preview that build with the API server running on port 5050.
- `npm run lint`: check JavaScript.
- `npm test`: API regression checks against the local `leave-management-test`
  database (override with `TEST_MONGODB_URI`). Removes its own test user afterward.

Login currently identifies a user by email only; no password authentication is implemented.
