# Project guidance

## Stack
- Frontend: React with Material UI (MUI).
- Backend: Python with FastAPI.
- Database: PostgreSQL.
- Follow the versions, libraries, patterns, and commands already used in this repository.
- Do not assume a tool or dependency is installed; inspect the project files first.
- You may propose adding dependencies when they help the task, but always explain the need and ask the user for approval before changing dependency manifests, lockfiles, or installing them.
- When implementing backend changes, run the local FastAPI development server with Uvicorn's `--reload` option so code changes are picked up automatically. After editing backend code, wait for reload and verify the API is responsive; do not ask the user to restart it manually. If reload is not available or a configuration/dependency change requires a full restart, explain the specific reason and required action.

## Required workflow
- Before making any changes, inspect the relevant code and explain your understanding of the request.
- Identify ambiguities, missing requirements, and decisions that could affect behavior. Ask me focused questions before editing if any of these could change the implementation.
- Before editing, present a concise plan that names the likely files, the intended changes, and relevant tests or checks. Stop and wait for my approval.
- Do not edit files, run database migrations, install packages, or make other changes until I approve the plan.
- If the task changes materially while working, pause and present an updated plan for approval.

## Implementation
- Keep changes focused and consistent with existing project conventions.
- Reuse existing components, API patterns, schemas, and database access code where appropriate.
- For React, use the project's existing component and state-management patterns. Use MUI components and theme conventions already in the codebase.
- For FastAPI, follow the existing router, Pydantic schema, dependency-injection, and error-handling patterns.
- For PostgreSQL changes, explain any schema or migration impact before proposing implementation. Do not apply migrations without approval.
- Do not invent API contracts, database columns, environment variables, or project commands. Ask if the repository does not establish them.

## After editing
- Summarize what changed, organized by file or feature.
- Explain how the code works and any important design choices.
- Report the tests, linting, or other checks you ran and their results. Clearly say if you did not run them.
- Mention any migration, configuration, or follow-up steps needed.