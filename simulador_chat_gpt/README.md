# Orbital · Simulador cuántico

Laboratorio web en español para construir circuitos, explorar estados entrelazados y experimentar con fotones individuales.

## Ejecutar con Docker

Requisitos: Docker Engine o Docker Desktop con Compose v2. Desde la carpeta que contiene `compose.yaml`, ejecuta:

```bash
docker compose up --build
```

Abre **http://localhost:4321**. La API y su documentación interactiva están en **http://localhost:8000/docs**. El primer arranque descarga imágenes y dependencias. Para detener los servicios conservando los subcircuitos:

```bash
docker compose down
```

## Primera comprobación

El editor abre con un par de Bell. En Statevector aparecen 00 y 11 con 50 % cada uno. Abre Configuración, cambia a Shot y compara las frecuencias con la columna de probabilidades teóricas. En la vista Aprender, selecciona Mach–Zehnder y emite una ráfaga con fase cero y ambos brazos abiertos: todas las detecciones corresponden a D0.

## Arquitectura

- **Frontend**. Astro compila las vistas y las tres lecciones Markdown. El cliente JavaScript mantiene el circuito de trabajo, los controles ópticos y las visualizaciones. Nginx sirve los archivos compilados en el puerto 4321 y reenvía /api/ al servicio api por la red privada de Compose. Para usar otra API se puede configurar PUBLIC_API_URL al construir.
- **Backend**. FastAPI en el puerto 8000 valida los operandos, los registros clásicos y los parámetros. El compilador expande ciclos y referencias con reasignación de cúbits. Qiskit construye los circuitos y Aer evoluciona vectores de estado o matrices de densidad. Los modelos de ruido aplican un canal local a cada cable de cada operación unitaria.
- **Medición y control**. Para las vistas teóricas, el motor proyecta y pondera las ramas de cada medición y aplica las correcciones según su memoria clásica. Para los shots, Aer ejecuta un circuito con medidas y control clásico dinámico. El muestreo final de todos los cúbits utiliza un registro de salida independiente. Las esferas muestran estados reducidos. Las amplitudes se muestran cuando el estado conjunto es puro.
- **Ejecución reactiva**. La interfaz agrupa las ediciones durante 150 ms. Un nuevo cambio aborta la consulta anterior, descarta respuestas tardías y sincroniza los paneles. El servidor ejecuta cada simulación en un proceso cancelable. La pausa permite acumular cambios antes de recalcular.
- **Persistencia**. La API guarda las definiciones en /data/blocks.json mediante reemplazo atómico en el volumen subcircuitos. El servidor incluido usa un solo proceso Uvicorn y serializa las modificaciones. Las instancias conservan la referencia a la definición, también dentro de ciclos y otros bloques. La API comprueba dependencias y rechaza referencias circulares. CORS_ORIGINS configura los orígenes autorizados para acceso directo.
- **Óptica**. Ambos experimentos evalúan en el navegador el modelo analítico del documento. Cambiar la configuración reinicia el conjunto de detecciones. Se distinguen detecciones, absorciones y frecuencias teóricas. En prueba oculta el escenario se elige al azar y se conserva hasta reiniciar o cambiarlo.

## Mejora adicional

**Deshacer** recupera hasta 40 versiones del circuito de trabajo, incluidos sus parámetros y estado inicial. Permite comparar un cambio, probar un algoritmo precargado o recuperar una secuencia eliminada. Las modificaciones de la biblioteca se guardan independientemente del historial del lienzo.

## Uso y límites

El editor muestra una operación por columna, en orden temporal. Para mover una operación, arrástrala antes de otra o al extremo derecho. Una compuerta de un solo cúbit también cambia de cable al moverla. Para cambiar los operandos de una operación multicúbit, usa Editar paso. Las instrucciones de cada experimento y de los algoritmos se encuentran en Aprender.

Se admiten 1–8 cúbits, 0–8 bits clásicos, 1–16 384 shots, hasta 128 repeticiones por ciclo, 2048 operaciones expandidas y seis mediciones intermedias. Los límites controlan el coste de las ramas y matrices de densidad. El botón Pausar afecta a la actualización de resultados. Las modificaciones de la biblioteca requieren acceso a la API.

## Pruebas

Con los servicios construidos:

```bash
docker compose run --rm api python -m unittest -v test_engine
```

El conjunto comprueba normalización, Bell, teleportación de estados con fase relativa, las cuatro funciones de Deutsch, medición con ruido y el mapeo en ciclos y subcircuitos anidados.

Para trabajar sin Docker, instala Python 3.12 y Node 22.12 o posterior. En backend, crea un entorno virtual, instala requirements.txt y ejecuta `uvicorn main:app --port 8000`. En frontend, ejecuta `npm ci` seguido de `npm run dev`. Abre http://localhost:4321.
