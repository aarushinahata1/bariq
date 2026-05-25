# CareFlow Manager

Healthcare CRM and patient management system for clinics and dental practices. Handles patient queues, appointments, billing, prescriptions, and waiting-time tracking.

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| State | TanStack Query, React Hook Form + Zod |
| Infra | Docker, GitHub Actions, GCP Cloud Run |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create env file
cp .env.example .env
# Edit .env — set DATABASE_URL to your Postgres connection string

# 3. Push schema to database
npm run db:push

# 4. Start dev server → http://localhost:5000
npm run dev
```

> **Dev mode auth**: All users are logged in as Admin (`admin@careflow.dev`). Swap in a real auth provider (Auth0, Clerk, etc.) for production.

## Features

- Patient management (CRUD)
- Doctor profiles and availability schedules
- Appointment booking and status tracking
- Real-time queue management with public waiting-room display
- Billing and invoicing
- Prescription management
- Dashboard analytics
- Role-based access — Admin, Doctor, Receptionist, Staff

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (client + server) |
| `npm start` | Run production build |
| `npm run check` | TypeScript type check |
| `npm run db:push` | Push schema changes to Postgres |

## Project Structure

```
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # UI components (shadcn/ui)
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Data-fetching & utility hooks
│   │   └── lib/             # Helpers, query client, utils
│   ├── vite.config.ts       # Vite config
│   ├── tailwind.config.ts   # Tailwind config
│   ├── postcss.config.js
│   └── components.json      # shadcn/ui config
├── server/                  # Express backend
│   ├── index.ts             # Entry point
│   ├── routes.ts            # API route handlers
│   ├── storage.ts           # Database operations
│   ├── db.ts                # DB connection
│   └── drizzle.config.ts    # Drizzle ORM config
├── shared/                  # Shared between client & server
│   ├── schema.ts            # DB schema & Zod validators
│   └── routes.ts            # API route contracts
├── script/
│   └── build.ts             # Production build script
├── Dockerfile
├── tsconfig.json
└── package.json
```

## Database

PostgreSQL — use [Supabase](https://supabase.com) (free tier) or any Postgres instance.

1. Create a Supabase project (or spin up local Postgres)
2. Copy the connection string into `.env` as `DATABASE_URL`
3. Run `npm run db:push` to create all tables

**Tables**: users, patients, appointments, doctor_profiles, bills, prescriptions, notifications, sessions

<details>
<summary><strong>Resetting the database</strong></summary>

Drop all tables in your Postgres instance (via Supabase dashboard or `psql`), then re-run:

```bash
npm run db:push
```

</details>

## Deployment

The app is Dockerized and deployed to **GCP Cloud Run** via GitHub Actions CI/CD.

```
git push main → GitHub Actions → Docker build → Artifact Registry → Cloud Run
```

<details>
<summary><strong>One-time GCP setup</strong></summary>

### 0. Set variables

Edit these once — every command below uses them.

```bash
export PROJECT_ID="your-gcp-project-id"
export PROJECT_NUMBER="123456789012"       # gcloud projects describe $PROJECT_ID --format='value(projectNumber)'
export REGION="asia-south1"
export REPO="careflow"
export SERVICE="careflow"
export GITHUB_REPO="your-org/MEDQUEUE"     # owner/repo
```

### 1. Install gcloud CLI

```bash
brew install google-cloud-sdk   # macOS
gcloud auth login
gcloud config set project $PROJECT_ID
```

### 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com
```

### 3. Create Artifact Registry repository

```bash
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION
```

### 4. Set up Workload Identity Federation for GitHub Actions

```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions deployer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Pool"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts add-iam-policy-binding \
  github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"
```

### 5. Add GitHub repo variables and secrets

| Name | Type | Value |
|------|------|-------|
| `GCP_PROJECT_ID` | Variable | GCP project ID |
| `GCP_PROJECT_NUMBER` | Variable | GCP project number |
| `GCP_REGION` | Variable | Deployment region |
| `DATABASE_URL` | Secret | PostgreSQL connection string |
| `SESSION_SECRET` | Secret | Random string (`openssl rand -base64 32`) |



### 6. Deploy

Push to `main` and GitHub Actions handles the rest. The first deploy creates the Cloud Run service automatically.

</details>

<details>
<summary><strong>Docker (local)</strong></summary>

```bash
docker build -t careflow .
docker run -p 5000:5000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="your-secret" \
  -e NODE_ENV=production \
  careflow
```

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

### Port in use

Change `PORT` in `.env` or kill the existing process:

```bash
lsof -ti :5000 | xargs kill
```

### Module not found

```bash
rm -rf node_modules package-lock.json
npm install
```

### Node version

Requires Node.js v20+. Use [nvm](https://github.com/nvm-sh/nvm) if you need to switch versions.

### Type errors

```bash
npm run check
```

</details>

<details>
<summary><strong>Design Guidelines</strong></summary>

### Approach

Material Design with healthcare-specific adaptations. Information-dense enterprise UI requiring clear hierarchy and professional medical aesthetic.

### Typography

- **Primary font**: DM Sans (body), Outfit (headings)
- Headers: 2xl/bold (page titles), xl/semibold (sections)
- Data: lg/bold for time slots and queue numbers
- Timestamps: sm/normal with reduced opacity

### Layout

- Main container: `max-w-7xl` with `px-4`
- Dashboard: 3-column grid (sidebar 1/6, main 4/6, info panel 1/6)
- Mobile: full-width stacking
- Spacing: Tailwind units 2, 4, 6, 8

### Status Colors

| Status | Color |
|--------|-------|
| Waiting | Amber |
| In Progress | Blue |
| Completed | Green |
| No-Show | Red |

### Key UX Patterns

- Live update pulse animation on new check-ins
- Undo toast notifications (bottom-right, dismissible)
- Confirmation modals for destructive actions
- Virtual scrolling for large lists
- Optimistic UI updates for status changes

</details>

## License

MIT
