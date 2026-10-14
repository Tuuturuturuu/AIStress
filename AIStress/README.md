# AIStress

Base de aplicación web con React, Material UI y una API en Python con FastAPI.

## Requisitos

- Node.js y npm
- Python 3.10 o posterior

## Iniciar el backend

Desde la raíz del proyecto, crea un entorno virtual e instala las dependencias:

```powershell
py -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --reload --app-dir backend --port 8000
```

La API está disponible en `http://localhost:8000`; su comprobación de salud está en `/api/health`.

## Iniciar el frontend

En otra terminal, desde la raíz del proyecto:

```powershell
Copy-Item frontend/.env.example frontend/.env
npm --prefix frontend run dev
```

Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`). La pantalla inicial comprueba la conexión con el backend.

## Compilar el frontend

```powershell
npm --prefix frontend run build
```

La configuración CORS del backend permite el servidor de desarrollo de Vite en `localhost:5173` y `127.0.0.1:5173`.
