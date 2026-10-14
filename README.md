# AIStress

Aplicación web con React, Material UI, FastAPI y PostgreSQL. El código está en `AIStress/`; permite crear usuarios y organizaciones y asignar usuarios a organizaciones.

## Requisitos

- Node.js y npm
- Python 3.10 o posterior
- Docker Desktop con Docker Compose

## PostgreSQL

Desde la raíz del repositorio, inicia la base de datos de desarrollo:

```powershell
docker compose -f AIStress/docker-compose.yml up -d db
```

Las credenciales incluidas son solo para desarrollo local; reemplázalas antes de desplegar.

## Backend

Desde la raíz del repositorio:

```powershell
py -m venv AIStress/backend/.venv
AIStress/backend/.venv/Scripts/Activate.ps1
python -m pip install -r AIStress/backend/requirements.txt
Copy-Item AIStress/backend/.env.example AIStress/backend/.env
python -m uvicorn app.main:app --reload --app-dir AIStress/backend --env-file AIStress/backend/.env --port 8000
```

La API se ejecuta en `http://localhost:8000`; `GET /api/health` comprueba la conexión con PostgreSQL y `/docs` muestra la documentación interactiva.

Incluye endpoints `GET`/`POST /api/users`, `GET`/`POST /api/organizations` y `POST /api/organizations/{organization_id}/members/{user_id}`.

## Frontend

En otra terminal, desde la raíz del repositorio:

```powershell
Copy-Item AIStress/frontend/.env.example AIStress/frontend/.env
npm --prefix AIStress/frontend run dev
```

Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`). Puedes crear usuarios y organizaciones, asignar membresías y consultar los registros.

## Verificación de producción

```powershell
npm --prefix AIStress/frontend run lint
npm --prefix AIStress/frontend run build
```

El backend permite peticiones CORS desde `localhost:5173` y `127.0.0.1:5173`. Esta base aún no incluye autenticación ni permisos; no la expongas públicamente sin añadirlos.