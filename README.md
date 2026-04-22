# Comic Creator

Aplicacion fullstack para crear historietas desde un lienzo digital. El usuario puede dibujar paneles, agregar globos de texto, mejorar un boceto con IA y exportar la historieta final como una imagen.

## Resumen

La arquitectura del proyecto esta dividida en tres piezas:

- `frontend/`: app React donde vive casi toda la experiencia de edicion.
- `backend/`: API FastAPI para proyectos y mejora de dibujos con IA.
- MongoDB: almacenamiento de proyectos.

El flujo actual es:

1. El frontend crea un proyecto al iniciar.
2. El usuario dibuja sobre un `canvas`.
3. Los paneles y globos de texto se manejan en el estado local del navegador.
4. Si el usuario pulsa "Mejorar con IA", el frontend envia la imagen actual al backend.
5. El backend llama a `fal-ai/flux-2/edit` y devuelve una imagen mejorada.
6. El frontend exporta la historieta final como PNG.

## Estructura del repositorio

```text
.
|-- backend/
|   |-- requirements.txt
|   `-- server.py
|-- frontend/
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

## Como funciona

### Frontend

La app principal entra por `frontend/src/App.js` y solo monta una ruta `/` que renderiza `ComicWorkspace`.

`frontend/src/components/ComicWorkspace.js` concentra la logica principal:

- herramientas de dibujo: pincel y borrador
- historial local para undo y redo
- manejo de paneles
- globos de texto con drag y resize
- llamada al backend para mejora con IA
- exportacion final a PNG

La interfaz esta organizada en cuatro zonas:

- header superior
- toolbar izquierda
- canvas central
- sidebar derecha con paneles y accion de IA

### Backend

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
- `fal-client` para la llamada al modelo de edicion de imagenes

### Persistencia actual

Hay una limitacion importante: aunque el backend soporta guardar y actualizar proyectos, el frontend hoy no persiste todas las ediciones del comic en MongoDB. Crea el proyecto al inicio y usa la API de mejora con IA, pero la mayoria del estado de trabajo sigue en memoria del navegador.

## Variables de entorno

### Backend

Definir estas variables antes de arrancar el servicio:

- `MONGO_URL`
- `DB_NAME`
- `FAL_KEY`
- `CORS_ORIGINS` opcional

### Frontend

- `REACT_APP_BACKEND_URL`

## Desarrollo local

### Backend

```powershell
cd backend
python -m pip install -r requirements.txt
$env:MONGO_URL="mongodb+srv://..."
$env:DB_NAME="comic_creator"
$env:FAL_KEY="..."
$env:CORS_ORIGINS="http://localhost:3000"
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```powershell
cd frontend
npm install --legacy-peer-deps
$env:REACT_APP_BACKEND_URL="http://localhost:8000"
npm start
```

## Despliegue

El repositorio no trae una infraestructura de despliegue completa. No hay `Dockerfile`, `docker-compose.yml`, CI/CD, ni documentacion operativa previa. Aun asi, el proyecto se puede desplegar manualmente como dos aplicaciones separadas.

### Estrategia recomendada

- MongoDB gestionado aparte
- backend desplegado como servicio Python ASGI
- frontend desplegado como sitio estatico
- `REACT_APP_BACKEND_URL` apuntando al backend publico
- `CORS_ORIGINS` restringido al dominio del frontend

### Despliegue manual del backend

```powershell
cd backend
python -m pip install -r requirements.txt
$env:MONGO_URL="mongodb+srv://..."
$env:DB_NAME="comic_creator"
$env:FAL_KEY="..."
$env:CORS_ORIGINS="https://tu-frontend.com"
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

### Despliegue manual del frontend

```powershell
cd frontend
npm install --legacy-peer-deps
$env:REACT_APP_BACKEND_URL="https://tu-backend.com"
npm run build
```

El contenido generado en `frontend/build` puede servirse desde cualquier hosting estatico o servidor web.

## Mejoras recomendadas

### 1. Persistencia real del proyecto

El frontend deberia llamar `PUT /api/projects/{id}` cuando cambian paneles o texto, idealmente con autosave y debounce. Hoy esa capacidad existe en el backend, pero no se usa desde la interfaz.

### 2. Cargar proyectos existentes

Falta una pantalla para listar y reabrir historietas usando:

- `GET /api/projects`
- `GET /api/projects/{id}`

### 3. Separar la logica del frontend

`ComicWorkspace` concentra demasiadas responsabilidades. Conviene dividirlo en modulos o hooks como:

- `useCanvasDrawing`
- `usePanels`
- `useProjectPersistence`
- `useTextBubbles`

### 4. Corregir problemas de codificacion

Hay textos rotos en la UI por encoding incorrecto. Los archivos deben normalizarse a UTF-8.

### 5. Mejorar undo y redo

El historial actual guarda snapshots completos del canvas en base64. Funciona, pero consume memoria rapido y no escala bien. A mediano plazo conviene guardar trazos o limitar historial por panel.

### 6. Exportar tambien los globos de texto

La exportacion arma una imagen con los paneles, pero no renderiza los globos HTML dentro del resultado final. Si se quiere una exportacion fiel, el texto debe dibujarse tambien en el canvas de salida.

### 7. Mejor manejo de errores

El backend devuelve `500` en casos donde deberian existir respuestas mas precisas como `400` o `422`. Tambien faltan mensajes de error mas claros cuando falla el proveedor de IA.

### 8. Seguridad

Faltan medidas basicas para produccion:

- autenticacion
- rate limiting
- validacion de tamano de imagen
- controles sobre payloads base64

### 9. Limpieza del repositorio

`frontend/src/components/ui` contiene una libreria amplia de componentes reutilizables que hoy casi no participa en el flujo principal. Se puede mantener, pero conviene documentar que no es parte critica del editor de comics.

### 10. Operacion y despliegue reproducible

Antes de un despliegue serio conviene agregar:

- `Dockerfile` para backend
- `Dockerfile` o estrategia documentada para frontend
- `.env.example`
- endpoint de health check en backend
- logs estructurados
- README operativo mas detallado

## Estado actual y limitaciones

- el frontend crea proyectos pero no guarda automaticamente todas las ediciones
- no hay autenticacion
- no hay infraestructura de despliegue declarativa
- el backend depende de variables de entorno no documentadas en archivos de ejemplo
- la exportacion no representa todos los elementos visuales superpuestos al canvas

## Pruebas

El archivo `backend_test.py` contiene pruebas de API sobre:

- conectividad del backend
- creacion y lectura de proyectos
- actualizacion de proyectos
- mejora con IA
- manejo de errores

Tambien existe `test_reports/iteration_1.json` con un resumen de pruebas previas. No hay una suite frontend formal integrada en el repositorio.
