# Job Search Dashboard

A full-stack job search dashboard. It pulls live job postings from the
[JobsPipe](https://jobspipe.dev) API, stores them in PostgreSQL, and shows them in a
sortable, filterable table. You can also add jobs by hand.

> **Status:** step 2 of 4 (backend API). See the [roadmap](#roadmap).

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    shell["shell (host app)<br/>:5173"]
    dashboard["dashboard (microfrontend)<br/>:5174"]
    jobForm["job-form (microfrontend)<br/>:5175"]
    shell -- loads at runtime --> dashboard
    shell -- loads at runtime --> jobForm
  end
  api["api (NestJS)<br/>:3000"]
  db[(PostgreSQL<br/>:5432)]
  jobspipe[[JobsPipe API]]
  dashboard -- GraphQL --> api
  jobForm -- GraphQL --> api
  api -- Prisma --> db
  api -- sync --> jobspipe
```

| App              | What it is                                                        | Port |
| ---------------- | ----------------------------------------------------------------- | ---- |
| `apps/shell`     | Host app: page layout and navigation. Loads the microfrontends.   | 5173 |
| `apps/dashboard` | Microfrontend: the job posts table.                               | 5174 |
| `apps/job-form`  | Microfrontend: form for adding a job by hand.                     | 5175 |
| `apps/api`       | NestJS backend. Holds the JobsPipe token so it never hits the UI. | 3000 |

The microfrontends are separate Vite apps joined with
[Module Federation](https://module-federation.io/). Each can also run on its own,
which is handy while developing.

## Tech stack

- **Frontend:** React 19, Vite, TypeScript (strict), Tailwind CSS 4, Module Federation
- **Backend:** NestJS, GraphQL (Apollo, code-first), Prisma 7, PostgreSQL (Docker)
- **Quality:** ESLint (typescript-eslint, react-hooks, jsx-a11y, import-x), Prettier,
  Husky + lint-staged, GitHub Actions CI
- **Tests:** Vitest + React Testing Library, MSW (mocks JobsPipe), API end-to-end tests against
  a real PostgreSQL; Playwright and Chromatic arrive in later steps
- **Monorepo:** pnpm workspaces + Turborepo

## Getting started

### 1. Install the tools (once)

| Tool                                                                                                                                             | Why               | Check it works                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------- |
| [Git](https://git-scm.com/downloads)                                                                                                             | Version control   | `git --version`                        |
| [Node.js 24 LTS](https://nodejs.org/)                                                                                                            | Runs JavaScript   | `node --version`                       |
| pnpm (`npm install -g pnpm@10` after installing Node)                                                                                            | Installs packages | `pnpm --version`                       |
| PostgreSQL 16: [Docker Desktop](https://www.docker.com/products/docker-desktop/) **or** a [native install](https://www.postgresql.org/download/) | Database          | `docker --version` or `psql --version` |
| [VS Code](https://code.visualstudio.com/)                                                                                                        | Editor            |                                        |

On Windows, if PowerShell says _"running scripts is disabled on this system"_, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. After installing any tool,
restart VS Code so its terminal can find it.

### 2. Get the code

```bash
git clone https://github.com/mohamedfaizel/job-search-dashboard.git
cd job-search-dashboard
pnpm install
```

When VS Code opens the folder, accept the prompt to install the recommended extensions.

### 3. Configure environment variables

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

`.env` is git-ignored. Put your JobsPipe API token in `JOBSPIPE_API_TOKEN`. Never commit it.

### 4. Run everything

```bash
pnpm db:up                                 # start PostgreSQL in Docker
pnpm --filter @jobsearch/api db:deploy     # create the tables (first time, and after pulling new migrations)
pnpm dev                                   # start the api and all three frontends
```

Open <http://localhost:5173>. Check the API at <http://localhost:3000/health>.

**Without Docker:** install PostgreSQL 16 natively (keep port 5432), skip `pnpm db:up`, and point
`.env` at it with the password you chose during setup:

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/jobsearch
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/jobsearch_test
```

`db:deploy` creates the database if it doesn't exist yet.

## Using the API

Open <http://localhost:3000/graphql> in your browser. It shows Apollo Sandbox, where you can
browse the whole schema and run operations. The schema is also written to
[`apps/api/schema.gql`](apps/api/schema.gql).

**Fetch jobs from JobsPipe** (each job fetched costs one JobsPipe credit):

```graphql
mutation {
  syncJobs(
    input: { titles: ["frontend"], skills: ["react"], countryCodes: ["DE"], maxAgeDays: 2 }
  ) {
    fetched
    created
    updated
    hasMore
    creditsRemaining
  }
}
```

**Query the table**, with filters, sorting and pages:

```graphql
query {
  jobsPage(
    filter: { skills: ["react"], workplaces: [REMOTE] }
    sort: { field: SALARY, direction: DESC }
    page: 1
    pageSize: 25
  ) {
    total
    items {
      title
      company {
        name
      }
      city
      salaryMinUsd
      salaryMaxUsd
      applicationStatus
    }
  }
}
```

**Add a job by hand** and **track your application**:

```graphql
mutation {
  createJob(input: { title: "Frontend Engineer", companyName: "Acme", skills: ["react"] }) {
    id
  }
}

mutation {
  updateJobStatus(id: "<id from above>", status: APPLIED) {
    id
    applicationStatus
  }
}
```

To look at the raw tables, run `pnpm --filter @jobsearch/api db:studio`.

### Database changes

The schema lives in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma). After
editing it, run `pnpm --filter @jobsearch/api db:migrate` and give the migration a name. That
creates a SQL file under `prisma/migrations` which is committed with your change.

## Scripts

| Command             | What it does                     |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Run every app in watch mode      |
| `pnpm build`        | Build every app                  |
| `pnpm test`         | Run all unit and component tests |
| `pnpm test:e2e`     | API tests against PostgreSQL     |
| `pnpm lint`         | Lint the whole repo              |
| `pnpm typecheck`    | Type-check every app             |
| `pnpm format`       | Format all files with Prettier   |
| `pnpm db:up`/`down` | Start or stop PostgreSQL         |

Run a script for one app with a filter, for example `pnpm --filter @jobsearch/dashboard test`.

A pre-commit hook (Husky + lint-staged) lints and formats the files you commit, so
unformatted code never lands in the repo.

## Roadmap

1. **Foundation:** monorepo, apps, tooling, CI
2. **Backend** (this step): Prisma schema, JobsPipe sync into PostgreSQL, GraphQL API
   (jobs query with filters/sorting, add-job and status mutations)
3. **Frontend:** sortable table with column filters, job description popup,
   add-job form, TanStack Query + Redux Toolkit, Storybook + Chromatic, MSW
4. **End-to-end and publish:** Playwright tests, screenshots, live deploy

Later: scheduled searches, Claude-powered resume builder, application status tracking.
