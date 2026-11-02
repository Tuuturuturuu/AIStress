# AIStress

Aplicación web con React, Material UI, FastAPI y PostgreSQL. Cada usuario puede pertenecer a una sola organización; cada organización se crea con un manager, y su rol se guarda en el usuario.

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

El inicio de sesión usa `AUTH_SESSION_SECRET` para firmar una cookie de sesión HttpOnly válida durante 8 horas. Genera un valor local con `python -c "import secrets; print(secrets.token_urlsafe(32))"` y guárdalo en `backend/.env`; no lo compartas ni lo subas a Git. En producción, configúralo en el almacén de secretos del proveedor.

## Esquema de la base de datos

- `users`: `user_id` (PK), `org_id` (FK nullable), `name`, `email`, `password_hash`, `role`, `accessibility` (JSON), `privacy_data` (JSON), `is_active`. `ADMIN` es un rol global y no puede pertenecer a una organización; `MANAGER` requiere organización.
- `organizations`: `org_id` (PK), `name`, `description`, `address`, `logo_path` (nullable), `is_active`. Cada organización necesita al menos un manager activo; puede tener varios.
- `organization_join_requests`: solicitudes con organización, usuario, estado (`PENDING`, `APPROVED`, `REJECTED` o `CANCELLED`), fechas y manager que tomó la decisión. Se conserva el historial.
- `models`: `model_id` (PK), `name`, `version`, `provider`, `country` (nullable), `year` (nullable), `category`, `is_active`. Las categorías iniciales son `AUDIO`, `VIDEO`, `IMAGE`, `CONVERSACIONAL`, `OPEN_SOURCE` y `ESPECIALIZADO_EN_RAZONAMIENTO`.
- `configurations`: `(user_id, model_id)` (PK compuesta y FKs), `credentials` (JSON cifrado como bytes), `endpoint` (texto nullable), `temperature` (decimal nullable), `max_tokens` (entero nullable). Solo un manager o un usuario sin organización puede tenerla; la configuración del manager es la que comparte su organización.
- `dimensions`: `dimension_id` (PK), `name`, `description` (texto nullable).
- `tests`: `test_id` (PK), `dimension_id` (FK), `name`, `description` (texto nullable), `is_active`.
- `evaluations`: `eval_id` (PK), `model_id` (FK), `user_id` (FK), `timestamp` (nullable hasta finalizar), `status`, `is_active`.
- `executions`: `exec_id` (PK), `eval_id` y `test_id` (FK), `prompt` (texto), `parameters` (JSON), `timestamp` (inicio automático), `status`.
- `results`: `result_id` (PK), `eval_id` (FK), `score` (numérico nullable), `response_result` y `response_data` (JSON nullable). No tiene campo `status`.

Los estados de `evaluations` y `executions` son `INACTIVA`, `EN_EJECUCION` y `TERMINADA`.

Los IDs son enteros autogenerados; las fechas se almacenan con zona horaria. Las contraseñas de usuarios se guardan con hash scrypt, no como texto. Las credenciales de modelos se cifran con Fernet y no deben devolverse a clientes. Para generar una clave local, después de instalar dependencias ejecuta:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Guarda el resultado como `CREDENTIALS_ENCRYPTION_KEY` en `backend/.env`, que no debe subirse a Git. Para despliegues, configura esa variable en el almacén de secretos del proveedor o inyéctala desde GitHub Secrets durante el despliegue. Conserva una copia segura de la clave: sin ella no se podrán descifrar credenciales existentes. pgAdmin mostrará el contenido cifrado, no las claves originales.

Endpoints disponibles:

- `POST /api/auth/register` registra una cuenta individual con rol `USER`; no acepta organización ni rol proporcionados por el cliente.
- `POST /api/auth/login` verifica email y contraseña y crea la sesión; los datos inválidos reciben siempre el mismo error.
- `GET /api/auth/me` devuelve el usuario de la sesión y `POST /api/auth/logout` la cierra.
- `PUT /api/profile/account` actualiza nombre, email y, si se solicita, contraseña (requiere la contraseña actual).
- `DELETE /api/profile/account` da de baja lógicamente la cuenta (requiere la contraseña actual), la desvincula de su organización y cancela sus solicitudes pendientes. No permite desactivar al último manager de una organización activa.
- `GET /api/profile/api-configurations` consulta los modelos activos y las configuraciones personales o de la organización; nunca devuelve credenciales.
- `POST /api/profile/api-configurations/{model_id}` añade una configuración para un modelo activo; `PUT /api/profile/api-configurations/{model_id}` actualiza la existente. Las credenciales se guardan cifradas. Managers editan la configuración compartida de su organización y los USER miembros solo pueden consultar qué modelos están configurados.
- `GET /api/profile/organization` consulta la organización y sus miembros; managers también ven solicitudes pendientes.
- `GET /api/profile/organization/search?q=...` busca organizaciones activas por nombre.
- `POST /api/profile/organization` crea una organización y convierte al creador en manager. Nombre, descripción y dirección son obligatorios; el logo es opcional.
- `POST /api/profile/organization/requests/{organization_id}` crea una solicitud de unión pendiente.
- `GET /api/profile/organization/requests` consulta el historial de solicitudes propias.
- `POST /api/profile/organization/requests/{request_id}/decision` permite a un manager de esa organización aprobar o rechazar.
- `POST /api/profile/organization/members/{user_id}/manager` permite a un manager promover a otro miembro activo.
- `POST /api/profile/organization/members/{user_id}/user` permite a un manager quitar el rol de manager a otro manager; siempre debe quedar al menos un manager activo.
- `DELETE /api/profile/organization/members/{user_id}` permite a un manager retirar a un miembro `USER` de su organización sin desactivar su cuenta.
- `DELETE /api/profile/organization` da de baja lógicamente la organización. Desvincula a sus miembros, convierte sus managers en usuarios y cancela las solicitudes pendientes sin eliminar configuraciones ni historial.
- Las acciones de cambio de rol, retirada de miembros y baja de organización requieren la contraseña actual del manager. `GET /api/users` y `GET /api/organizations` son consultas exclusivas de ADMIN.

La portada pública está disponible en `/` y `/welcome`. Sin sesión muestra los accesos a `/login` y `/sign-in`, además de una vista previa interactiva; al completar el registro se inicia sesión automáticamente y se abre `/welcome`. Con sesión, el encabezado ofrece acceso al perfil y cierre de sesión. El perfil está disponible en `/profile`.

En el perfil, las pestañas **Account**, **Organization**, **Accessibility** y **Privacy Data** permiten gestionar la cuenta y la organización; Accessibility y Privacy Data quedan vacías por ahora. El creador de una organización se convierte en su primer manager. Los demás usuarios solicitan unirse y un manager debe aprobarlos. Al aprobar la solicitud se eliminan, dentro de la misma transacción, las configuraciones personales del usuario; la acción no puede deshacerse. Los managers pueden promover y degradar a otros managers, y dar de baja la organización. Las bajas son lógicas y conservan configuraciones e historial.

La pestaña **API Configurations** permite que un USER sin organización gestione sus configuraciones personales, o que un manager añada y edite las compartidas por su organización. Los demás miembros solo ven los modelos configurados. Las credenciales se cifran y nunca se devuelven al navegador. Por ahora se introducen como un objeto JSON; los formularios específicos de cada proveedor y las llamadas de prueba/ejecución de sus APIs quedan para una fase posterior. El selector usa las filas activas de `models`; aún no hay una pantalla para mantener ese catálogo.

El panel `/admin-panel` es de solo consulta y requiere una sesión ADMIN activa. ADMIN es global, no pertenece a una organización ni puede solicitar acceso. Las imágenes de logo admitidas son PNG, JPEG y WebP, hasta 5 MiB; se guardan en `backend/uploads/organizations` y se sirven desde `/media`. Esa carpeta queda fuera de Git y debe incluirse en las copias de seguridad del servidor.

## Pruebas del backend

Instala las dependencias de desarrollo y ejecuta las pruebas desde la raíz:

```powershell
python -m pip install -r backend/requirements-dev.txt
python -m pytest -c backend/pytest.ini
```

Las pruebas de registro, perfil y organizaciones usan una base SQLite temporal y no modifican la base de desarrollo.

Las entidades `Model`, `Configuration`, `Dimension`, `Test`, `Evaluation`, `Execution` y `Result` ya están definidas en la base de datos, pero aún no tienen endpoints HTTP para administrarlas.

### Migrar una base ya existente

Antes de arrancar la versión que incorpora el perfil de organización, detén el backend y ejecuta [002_profile_organizations.sql](backend/migrations/002_profile_organizations.sql) en pgAdmin. Esta migración incremental conserva los registros, separa cualquier ADMIN que tuviera `org_id`, añade los datos de organización y el historial de solicitudes, y elimina la restricción de un único manager. Si detecta una organización sin manager activo, aborta sin completar la migración para que se corrija primero.

Si ya aplicaste la migración 002, detén el backend y ejecuta también [003_expand_join_request_status.sql](backend/migrations/003_expand_join_request_status.sql). Amplía `organization_join_requests.status` para admitir el estado `CANCELLED` sin alterar las solicitudes existentes.

Para permitir reutilizar el nombre de una organización dada de baja, detén el backend y ejecuta [004_active_organization_names.sql](backend/migrations/004_active_organization_names.sql). Conserva la unicidad entre organizaciones activas y libera los nombres de las inactivas.

Para convertir las configuraciones de los managers en configuraciones compartidas por organización, detén el backend y ejecuta [005_api_configurations_owner.sql](backend/migrations/005_api_configurations_owner.sql). Migra las configuraciones existentes de cada manager a su organización, preserva las configuraciones personales y bloquea la operación sin cambiar datos si detecta más de una configuración para el mismo modelo y organización. Después de la migración, inicia o recarga el backend para instalar las nuevas restricciones de propiedad.

El backend instala en PostgreSQL restricciones diferidas para asegurar que cada organización termine cada transacción con al menos un manager activo, ADMIN no pertenezca a ninguna organización y solo managers o usuarios sin organización tengan configuraciones. La unión aprobada elimina automáticamente las configuraciones personales como parte de su transacción.

## Iniciar el frontend

En otra terminal, desde la raíz del proyecto:

```powershell
Copy-Item frontend/.env.example frontend/.env
npm --prefix frontend run dev
```

Abre la dirección local que muestra Vite (normalmente `http://localhost:5173`). Los usuarios se registran desde `/sign-in`, gestionan su cuenta y pertenencia organizativa en `/profile`, y ADMIN consulta los datos globales desde `/admin-panel`.

## Compilar el frontend

```powershell
npm --prefix frontend run build
```

La configuración CORS permite el servidor de desarrollo de Vite en `localhost:5173` y `127.0.0.1:5173`.

## Seguridad

La aplicación no ofrece recuperación de contraseñas. Protege `AUTH_SESSION_SECRET` y usa HTTPS en producción; el navegador recibe la cookie como HttpOnly, SameSite=Lax y Secure sobre HTTPS.
