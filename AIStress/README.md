# AIStress

Aplicación web con React, Material UI, FastAPI y PostgreSQL. Permite crear usuarios, crear organizaciones y asignar usuarios a organizaciones.

## Requisitos

- Node.js y npm
- Python 3.10 o posterior
- Docker Desktop con Docker Compose (para PostgreSQL local)

## Iniciar PostgreSQL

Desde la raíz del proyecto, inicia PostgreSQL y pgAdmin:

```powershell
docker compose up -d
```

PostgreSQL queda disponible en el puerto `5432`. Las credenciales de Compose son exclusivamente para desarrollo local; cámbialas antes de desplegar.

### Visualizar la base de datos con pgAdmin

Abre `http://localhost:5050` e inicia sesión con `admin@aistress.com` y `admin_dev`. En pgAdmin, registra un servidor con estos valores:

- **Name:** AIStress local
- **Host name/address:** `db`
- **Port:** `5432`
- **Maintenance database:** `aistress`
- **Username:** `aistress`
- **Password:** `aistress_dev`

El host `db` funciona porque pgAdmin y PostgreSQL están en la misma red de Docker Compose. Las credenciales son solo para desarrollo local.

Si ya tienes PostgreSQL instalado como servicio de Windows, no necesitas iniciar el contenedor. Asegúrate de que `DATABASE_URL` en `backend/.env` tenga el usuario, contraseña, puerto y base de datos que existen en ese servicio. El valor de ejemplo solo coincide con la configuración de Compose.

## Iniciar el backend

Desde la raíz del proyecto, crea un entorno virtual e instala las dependencias:

```powershell
py -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
python -m uvicorn app.main:app --reload --app-dir backend --env-file backend/.env --port 8000
```

La API está en `http://localhost:8000`; `GET /api/health` informa el estado de PostgreSQL y la documentación interactiva está en `/docs`.
Si la conexión a la base falla, FastAPI seguirá iniciado en modo degradado, pero las operaciones de usuarios y organizaciones responderán con HTTP 503 hasta que corrijas `DATABASE_URL` y reinicies el backend.

Endpoints disponibles:

- `GET` y `POST /api/users`
- `GET` y `POST /api/organizations`
- `POST /api/organizations/{organization_id}/members/{user_id}` para agregar un usuario a una organización

Las tablas iniciales se crean al arrancar la API. Para cambios de esquema en producción, utiliza migraciones.

## Iniciar el frontend

En otra terminal, desde la raíz del proyecto:

```powershell
Copy-Item frontend/.env.example frontend/.env
npm --prefix frontend run dev
```

Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`). La interfaz permite crear usuarios y organizaciones, asignar membresías y consultar los registros existentes.

## Compilar el frontend

```powershell
npm --prefix frontend run build
```

La configuración CORS permite el servidor de desarrollo de Vite en `localhost:5173` y `127.0.0.1:5173`.

## Seguridad

Esta base administra perfiles y membresías, pero todavía no implementa inicio de sesión, contraseñas, roles ni permisos. No la expongas a Internet ni almacenes contraseñas sin añadir antes autenticación segura.
