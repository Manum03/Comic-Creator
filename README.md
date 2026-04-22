# Comic Creator

Aplicacion fullstack para crear historietas desde un lienzo digital. El usuario puede dibujar paneles, agregar globos de texto, mejorar un boceto con IA y exportar la historieta final como una imagen.

## Resumen

La arquitectura del proyecto esta dividida en tres piezas:

- `frontend/`: app React donde vive casi toda la experiencia de edicion.
- `backend/`: API FastAPI para proyectos y mejora de dibujos con IA.
- MongoDB Atlas: almacenamiento de proyectos.
- fal.ai: proveedor de edicion de imagenes para mejorar dibujos.

El flujo actual es:

1. El frontend crea un proyecto al iniciar.
2. El usuario dibuja sobre un `canvas`.
3. Los paneles y globos de texto se manejan en el estado local del navegador.
4. Si el usuario pulsa `Mejorar con IA`, el frontend envia la imagen actual al backend como `data:image/...;base64,...`.
5. El backend llama a `fal-ai/flux-2/edit` usando `fal-client`.
6. El backend devuelve `improvedImage` con una URL remota generada por fal.
7. El frontend carga esa imagen mejorada en el canvas.

## Estructura del repositorio

```text
.
|-- backend/
|   |-- .env
|   |-- requirements.txt
|   `-- server.py
|-- frontend/
|   |-- .env
|   |-- package.json
|   |-- craco.config.js
|   |-- public/
|   `-- src/
|       |-- App.js
|       |-- index.js
|       `-- components/
|           `-- ComicWorkspace.js
|-- tests/
|-- test_reports/
|-- backend_test.py
|-- design_guidelines.json
`-- README.md
```

## Backend

`backend/server.py` expone una API FastAPI con estos endpoints:

- `GET /api/`: verificacion basica
- `POST /api/panels/improve`: mejora un dibujo a partir de una imagen base64 o data URL
- `POST /api/projects`: crea un proyecto
- `GET /api/projects`: lista proyectos
- `GET /api/projects/{project_id}`: obtiene un proyecto
- `PUT /api/projects/{project_id}`: actualiza titulo y paneles

El backend usa:

- `motor` para MongoDB asincrono
- `pydantic` para validacion de modelos
- `fal-client` para la llamada al modelo `fal-ai/flux-2/edit`

Notas importantes del endpoint de mejora:

- espera `canvasData` y `prompt`
- acepta `canvasData` como data URL o base64 simple
- si recibe base64 simple, lo convierte a `data:image/png;base64,...`
- devuelve `ImproveDrawingResponse` con:
  - `improvedImage: string`
  - `message: string`
- `improvedImage` ahora es una URL remota de fal, no una data URL local

## Frontend

La app principal entra por `frontend/src/App.js` y renderiza `ComicWorkspace`.

`frontend/src/components/ComicWorkspace.js` concentra:

- herramientas de dibujo: pincel y borrador
- historial local para undo y redo
- manejo de paneles
- globos de texto con drag y resize
- llamada al backend para mejora con IA
- exportacion final a PNG

El frontend requiere `REACT_APP_BACKEND_URL`. Si no esta definida, las llamadas al backend fallan con `404`.

## Variables de entorno

### Backend

El backend carga automaticamente `backend/.env` con `python-dotenv`.

Contenido recomendado para `backend/.env`:

```env
MONGO_URL=mongodb+srv://USUARIO:PASSWORD@comic-creator.qvigvpa.mongodb.net/?appName=comic-creator
DB_NAME=comic_creator
FAL_KEY=tu_api_key_de_fal
CORS_ORIGINS=http://localhost:3000
```

Notas:

- no uses `<db_password>` literalmente; reemplazalo por tu password real de MongoDB Atlas
- si la password o la API key se expusieron en consola, capturas o commits, rotalas
- `CORS_ORIGINS` debe apuntar al dominio real del frontend en despliegue

### Frontend

Contenido recomendado para `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

## Configuracion de MongoDB Atlas

1. Crea un cluster en MongoDB Atlas.
2. Crea un usuario en `Database Access`.
3. Autoriza tu IP en `Network Access`.
4. Copia la cadena de conexion tipo:

```text
mongodb+srv://USUARIO:PASSWORD@comic-creator.qvigvpa.mongodb.net/?appName=comic-creator
```

5. Usa `comic_creator` como `DB_NAME`.

Si Atlas no autoriza tu IP, el backend puede arrancar pero fallar al crear o consultar proyectos.

## Desarrollo local

### Requisitos

- Python 3.13
- Node.js
- MongoDB Atlas configurado
- API key de fal valida

### Instalacion backend

```powershell
cd backend
python -m pip install -r requirements.txt
```

### Instalacion frontend

```powershell
cd frontend
npm install --legacy-peer-deps
```

Si aparece un error relacionado con `ajv`, reinstala:

```powershell
npm install ajv@^8.18.0 ajv-keywords@^5.1.0 --legacy-peer-deps
```

### Arranque backend

Usando `backend/.env`:

```powershell
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Nota:

- en este entorno Windows, `--reload` puede fallar por permisos del reloader de `uvicorn`
- para desarrollo local simple, usa el comando sin `--reload`

### Arranque frontend

Usando `frontend/.env`:

```powershell
cd frontend
npm start
```

### URLs locales

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`
- docs del backend: `http://localhost:8000/docs`

## Verificacion rapida

1. Abre `http://localhost:8000/api/`
2. Abre `http://localhost:3000`
3. Dibuja algo
4. Pulsa `MEJORAR CON IA`

Si todo esta bien:

- el frontend no debe lanzar `404`
- el backend debe responder `200` en `POST /api/panels/improve`
- el canvas debe reemplazarse con la imagen mejorada

## Resolucion de problemas

### `404` al mejorar el dibujo

Causa probable:

- `REACT_APP_BACKEND_URL` no esta definido o apunta a una URL incorrecta

Solucion:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Luego reinicia `npm start`.

### `500 Internal Server Error` en `POST /api/panels/improve`

Causas probables:

- `FAL_KEY` no esta cargada
- `FAL_KEY` es invalida
- fal rechazo la peticion
- no hay salida de red desde el backend

Comprobacion:

- revisa `backend/.env`
- prueba el endpoint en `http://localhost:8000/docs`
- revisa `Network > Response` en el navegador

### `KeyError: 'MONGO_URL'`

Causa probable:

- el backend no esta leyendo `backend/.env`

Solucion:

- confirma que el archivo exista en `backend/.env`
- confirma que tenga `MONGO_URL`, `DB_NAME`, `FAL_KEY` y `CORS_ORIGINS`
- inicia el backend desde la carpeta `backend`

### `npm install` falla por conflicto de dependencias

Usa:

```powershell
npm install --legacy-peer-deps
```

### PowerShell bloquea `npm`

Si `npm.ps1` esta bloqueado, usa:

```powershell
npm.cmd install --legacy-peer-deps
npm.cmd start
```

## Seguridad

- no subas `backend/.env` ni `frontend/.env` al repositorio
- rota cualquier password o API key expuesta en capturas, chat o commits
- restringe `CORS_ORIGINS` en produccion
- restringe `Network Access` en MongoDB Atlas a IPs o redes confiables

## Despliegue

El proyecto no incluye Docker ni CI/CD, pero ya esta listo para desplegarse manualmente despues de subir el repo.

### Backend en produccion

Variables necesarias:

```env
MONGO_URL=mongodb+srv://USUARIO:PASSWORD@comic-creator.qvigvpa.mongodb.net/?appName=comic-creator
DB_NAME=comic_creator
FAL_KEY=tu_api_key_de_fal
CORS_ORIGINS=https://tu-frontend.com
```

Comandos:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

### Frontend en produccion

Variables necesarias:

```env
REACT_APP_BACKEND_URL=https://tu-backend.com
```

Comandos:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run build
```

El contenido generado en `frontend/build` puede publicarse en un hosting estatico.

### Checklist antes de desplegar

- crear y cargar `backend/.env` en el entorno del servidor
- crear y cargar `frontend/.env` o variables equivalentes en build
- configurar MongoDB Atlas con usuario y red permitida
- configurar `FAL_KEY` valida
- apuntar `REACT_APP_BACKEND_URL` al backend publico
- ajustar `CORS_ORIGINS` al dominio real del frontend
- rotar credenciales que hayan sido expuestas durante desarrollo

## Estado actual y limitaciones

- el frontend crea proyectos pero no guarda automaticamente todas las ediciones
- no hay autenticacion
- no hay infraestructura de despliegue declarativa
- la exportacion no representa todos los elementos visuales superpuestos al canvas
- el endpoint de mejora depende de un servicio externo y de una API key valida

## Pruebas

El archivo `backend_test.py` contiene pruebas de API sobre:

- conectividad del backend
- creacion y lectura de proyectos
- actualizacion de proyectos
- mejora con IA
- manejo de errores

No hay una suite frontend formal integrada en el repositorio.
