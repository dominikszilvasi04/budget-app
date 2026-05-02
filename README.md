# Budget Tracker

Budget Tracker is a full-stack personal finance application for managing day-to-day transactions, monthly budgets, recurring rules, savings goals, and forward-looking forecasts.

## Features

- Dashboard with income/expense overview and category-level budget visibility
- Category management (create, update, delete)
- Transaction history with filtering, editing, CSV import/export
- Monthly budgeting with period switching and budget rollover
- Savings goals with contribution tracking
- Recurring transaction rules (weekly/monthly) with manual processing
- Insights and trend visualisation
- Forecast planner with scenario support and confidence range

## Screenshots

https://imgur.com/a/I5FyabG

## Tech Stack

- Frontend: React, React Router, Axios, Chart.js
- Backend: Node.js, Express
- Database: MySQL
- Tooling: ESLint, Prettier, Docker, GitHub Actions

## Repository Structure

- [client](client) React application
- [server](server) Express API and database access
- [docker-compose.yml](docker-compose.yml) local multi-service development stack
- [.github/workflows](.github/workflows) CI and container build workflows

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8+
- npm

### 1) Configure environment

Create [server/.env](server/.env) with your database connection values:

- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT` (optional, default `5001`)

### 2) Install dependencies

- `cd server && npm install`
- `cd ../client && npm install`

### 3) Run locally

- API: `cd server && npm run dev`
- Web app: `cd client && npm start`

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`

## Docker

Run the full stack with Docker Compose:

- `docker compose up --build`

Relevant files:

- [server/Dockerfile](server/Dockerfile)
- [client/Dockerfile](client/Dockerfile)
- [docker-compose.yml](docker-compose.yml)

## Quality Checks

- Client lint: `cd client && npm run lint`
- Server lint: `cd server && npm run lint`
- Formatting check: `npx prettier@3.3.3 --check "**/*.{js,jsx,json,css,md,yml,yaml}"`

## CI

The project includes GitHub Actions workflows for pushes and pull requests:

- [CI workflow](.github/workflows/ci.yml)
- [Container build workflow](.github/workflows/container-build.yml)

## Licence

For now, this repository does not define a licence file.