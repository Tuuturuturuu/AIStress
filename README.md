# AIStress

Aplicación web inicial con React, Material UI y un backend Python con FastAPI. El código de la aplicación está en la carpeta `AIStress/`.

## Requisitos

- Node.js y npm
- Python 3.10 o posterior

## Backend

Desde la raíz del repositorio:

```powershell
py -m venv AIStress/backend/.venv
AIStress/backend/.venv/Scripts/Activate.ps1
python -m pip install -r AIStress/backend/requirements.txt
python -m uvicorn app.main:app --reload --app-dir AIStress/backend --port 8000
```

La API incluye `GET /api/health` y se ejecuta en `http://localhost:8000`.

## Frontend

En otra terminal, desde la raíz del repositorio:

```powershell
Copy-Item AIStress/frontend/.env.example AIStress/frontend/.env
npm --prefix AIStress/frontend run dev
```

Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`). La pantalla inicial comprueba la conexión con FastAPI.

## Verificación de producción

```powershell
npm --prefix AIStress/frontend run lint
npm --prefix AIStress/frontend run build
```

El backend permite peticiones CORS desde `localhost:5173` y `127.0.0.1:5173`.