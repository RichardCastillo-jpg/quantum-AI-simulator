# QuLab — Emulador Interactivo de Circuitos y Óptica Cuántica

Emulador web interactivo para diseñar y simular circuitos cuánticos, explorar algoritmos precargados (Teleportación Cuántica y Algoritmo de Deutsch) y experimentar con óptica cuántica en el módulo **Aprende** (Interferómetro de Mach-Zehnder y Bombas de Elitzur-Vaidman).

## Arquitectura del Sistema

El proyecto utiliza una arquitectura cliente-servidor desacoplada y contenerizada mediante `docker-compose`:

1. **Backend (`backend/`, FastAPI + Qiskit / Qiskit Aer, puerto `8000`)**
   - Expone la API REST (`POST /api/simulate`) que valida la definición JSON del circuito —incluyendo las 17 compuertas, mediciones, control clásico condicional, ciclos `for`, subcircuitos anidados y modelos de ruido (`none`, `depolarizing`, `thermal_relaxation`)—, la traduce a un `QuantumCircuit` de Qiskit y la ejecuta en `AerSimulator` en modo `statevector` o `shot`.
   - Gestiona el ciclo de vida CRUD (`/api/subcircuits`) persistiendo los subcircuitos en archivos JSON dentro del volumen montado en `/app/data`.

2. **Frontend (`frontend/`, Astro / Web Reactiva, puerto `4321`)**
   - Sirve la interfaz interactiva con editor de circuitos *drag-and-drop*, selección guiada en dos/tres clics para compuertas multi-cúbit, esferas de Bloch 3D interactivas, algoritmos precargados y el módulo **Aprende** (3 lecciones en Markdown + simuladores de Mach-Zehnder y Elitzur-Vaidman).
   - Implementa ejecución automática reactiva con *debounce* en controles continuos, cancelación de ejecuciones obsoletas e interruptor de pausa opcional.

3. **Persistencia y Red (`docker-compose.yml`)**
   - Orquesta ambos contenedores dentro de la red puente `quantum-net`, configura políticas de CORS entre `http://localhost:4321` y `http://localhost:8000`, y monta el volumen `./data:/app/data` para conservar los subcircuitos entre reinicios.

## Mejora Libre Realizada

Sobre todos los requerimientos base, se incorporaron dos capacidades de alto impacto para el análisis y depuración cuántica:

1. **Inspección Paso a Paso por Capa (*Time-Step Scrubber*):** Un control deslizante y modo de animación secuencial en la base del editor que permite recorrer el circuito capa por capa (desde el estado inicial hasta la capa final), resaltando la columna activa y actualizando en vivo las esferas de Bloch 3D, el histograma y la tabla de amplitudes.
2. **Exportación Automática a OpenQASM 2.0 y Python (Qiskit Aer):** Un generador integrado que traduce el circuito actual —desenrollando ciclos `for`, subcircuitos y control clásico— en código OpenQASM 2.0 y en un script completo de Qiskit listo para copiar y ejecutar.

## Guía de Ejecución con Docker

### Requisitos previos
- Docker 24+ y Docker Compose v2 (`docker compose`).

### Pasos de ejecución
```bash
# 1. Descomprimir el proyecto y entrar al directorio
cd qulab_proyecto

# 2. Construir e iniciar los contenedores (Backend en :8000, Frontend en :4321)
docker compose up --build -d

# 3. Verificar estado de los servicios
docker compose ps
```

- **Interfaz web:** `http://localhost:4321`
- **Documentación interactiva de la API (Swagger):** `http://localhost:8000/docs`

### Detener los servicios
```bash
docker compose down
```
Los subcircuitos guardados permanecerán intactos en el directorio local `./data/`.
