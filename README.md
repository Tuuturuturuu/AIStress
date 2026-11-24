# AIStress

Aplicación web con React, Material UI, FastAPI y PostgreSQL. El código está en `AIStress/`; permite crear usuarios y organizaciones y asignar usuarios a organizaciones.

## Requisitos

- Node.js y npm
- Python 3.10 o posterior
- Docker Desktop con Docker Compose

## PostgreSQL

Desde la raíz del repositorio, inicia la base de datos de desarrollo y pgAdmin (el mismo comando sirve en Windows, macOS y Linux):

```powershell
docker compose -f AIStress/docker-compose.yml up -d db pgadmin
```

Las credenciales incluidas son solo para desarrollo local; reemplázalas antes de desplegar.

### pgAdmin

pgAdmin es un panel web para consultar la base de datos. Ábrelo en `http://localhost:5051` e inicia sesión con:

- **Email:** `admin@aistress.com`
- **Contraseña:** `admin_dev`

La primera vez, registra el servidor (*Register → Server*) con estos datos en la pestaña *Connection*:

| Campo | Valor |
|---|---|
| Host | `db` |
| Puerto | `5432` |
| Base de datos | `aistress` |
| Usuario | `aistress` |
| Contraseña | `aistress_dev` |

El host es `db` (el nombre del servicio dentro de Docker), no `localhost`, porque pgAdmin se conecta desde su propio contenedor.

pgAdmin usa el puerto 5051 en lugar del 5050 habitual porque algunos equipos ya tienen el 5050 ocupado (por ejemplo, el agente de seguridad Nessus). Si el 5051 también está ocupado en tu equipo, cambia el primer número de `"5051:80"` en `AIStress/docker-compose.yml`.

## Backend

Desde la raíz del repositorio:

### Windows (PowerShell)

```powershell
py -m venv AIStress/backend/.venv
AIStress/backend/.venv/Scripts/Activate.ps1
python -m pip install -r AIStress/backend/requirements.txt
Copy-Item AIStress/backend/.env.example AIStress/backend/.env
python -m uvicorn app.main:app --reload --app-dir AIStress/backend --env-file AIStress/backend/.env --port 8000
```

### macOS / Linux

En macOS no existe el comando `py`; usa `python3`. El Python que trae macOS (3.9) es demasiado antiguo, así que instala uno más reciente, por ejemplo con Homebrew: `brew install python@3.12`.

```bash
python3.12 -m venv AIStress/backend/.venv
source AIStress/backend/.venv/bin/activate
python -m pip install -r AIStress/backend/requirements.txt
cp AIStress/backend/.env.example AIStress/backend/.env
python -m uvicorn app.main:app --reload --app-dir AIStress/backend --env-file AIStress/backend/.env --port 8000
```

Con el entorno virtual activo, `python` apunta al del `.venv`. En cada terminal nueva hay que volver a activarlo con `source AIStress/backend/.venv/bin/activate`.

La API se ejecuta en `http://localhost:8000`; `GET /api/health` comprueba la conexión con PostgreSQL y `/docs` muestra la documentación interactiva.

Incluye endpoints `GET`/`POST /api/users`, `GET`/`POST /api/organizations` y `POST /api/organizations/{organization_id}/members/{user_id}`.

## Frontend

En otra terminal, desde la raíz del repositorio:

### Windows (PowerShell)

```powershell
Copy-Item AIStress/frontend/.env.example AIStress/frontend/.env
npm --prefix AIStress/frontend run dev
```

### macOS / Linux

```bash
cp AIStress/frontend/.env.example AIStress/frontend/.env
npm --prefix AIStress/frontend install
npm --prefix AIStress/frontend run dev
```

La primera vez hace falta `npm install` para descargar las dependencias (en Windows también).

Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`). Puedes crear usuarios y organizaciones, asignar membresías y consultar los registros.

## Verificación de producción

```powershell
npm --prefix AIStress/frontend run lint
npm --prefix AIStress/frontend run build
```

El backend permite peticiones CORS desde `localhost:5173` y `127.0.0.1:5173`. Esta base aún no incluye autenticación ni permisos; no la expongas públicamente sin añadirlos.
