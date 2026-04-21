# Personal Budget and Goals Tracker

A full-stack web application designed to provide a clear and intuitive way to manage personal finances. Track income and expenses, set monthly budgets for different categories, and create savings goals to visualise progress towards financial targets.

This application features a React frontend that communicates with a robust Node.js and Express backend, powered by a MySQL database.

## Key Features

* **Dashboard Overview**: A central hub to view income vs. expense categories, see budget progress, and quickly add new transactions.
* **Dynamic Categories**: Create, update, and delete custom categories for both income and expenses, each with a unique colour for easy identification.
* **Transaction Management**: Log all transactions with details like description, amount, and date. View a comprehensive transaction history, sortable by type.
* **Advanced History Controls**: Filter by type/category/date/amount/search, edit existing transactions, and import or export transactions as CSV.
* **Monthly Budgeting**: Allocate a specific budget for each expense category for the current month and track your spending against it.
* **Budget Period Planning**: Switch month views and roll over the previous month budget into a new period.
* **Savings Goals**: Create detailed savings goals with target amounts and dates. Make contributions directly or link them to income transactions.
* **Recurring Transactions**: Configure weekly or monthly recurring transaction rules and process due entries on demand.
* **Data Visualisation**: Interactive charts on the dashboard and history pages provide a clear visual breakdown of financial habits.
* **Insights Dashboard**: Review monthly net trend and top categories over configurable time windows.

## Screenshots
https://imgur.com/a/I5FyabG

## Tech Stack

* **Frontend**: React, React Router, Axios, Chart.js
* **Backend**: Node.js, Express.js
* **Database**: MySQL
* **Development**: Nodemon

## CI/CD and Quality Gates

This repository now includes automated pipelines for pushes and pull requests:

- [CI pipeline](.github/workflows/ci.yml)
	- installs client and server dependencies
	- runs lint checks for client and server
	- runs Prettier formatting checks
	- runs client tests
	- builds the client production bundle
- [Container build pipeline](.github/workflows/container-build.yml)
	- validates Docker builds for both server and client images

## Linting and Formatting

- Client lint: run `npm run lint` in [client/package.json](client/package.json)
- Server lint: run `npm run lint` in [server/package.json](server/package.json)
- Formatting check (root): `npx prettier@3.3.3 --check "**/*.{js,jsx,json,css,md,yml,yaml}"`

## Containers

- Server image: [server/Dockerfile](server/Dockerfile)
- Client image: [client/Dockerfile](client/Dockerfile)
- Local multi-service setup: [docker-compose.yml](docker-compose.yml)

To build and run with Docker Compose:

1. Ensure Docker Desktop is running.
2. Run `docker compose up --build` from the repository root.
3. Open the client at `http://localhost:3000`.