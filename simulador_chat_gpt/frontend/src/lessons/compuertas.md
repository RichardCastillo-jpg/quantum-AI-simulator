## Guía de compuertas

| Compuerta | Efecto |
| --- | --- |
| H · Hadamard | Mapea 0 a la superposición de igual amplitud y 1 a la misma superposición con signo relativo negativo. |
| X · NOT | Intercambia las amplitudes de 0 y 1. |
| Y · Pauli Y | Lleva 0 a i·1 y 1 a −i·0 en notación de estados base. |
| Z · Pauli Z | Cambia el signo de la amplitud de 1. |
| I · Identidad | Conserva el estado ideal. |
| SX | Raíz cuadrada de X. Dos aplicaciones equivalen a X. |
| S | Multiplica la amplitud de 1 por i. |
| S† | Deshace S mediante una fase de −π/2. |
| T | Añade una fase de π/4 a la amplitud de 1. |
| T† | Deshace T mediante una fase de −π/4. |
| P(φ) | Introduce una fase relativa arbitraria φ en 1. |
| RX(θ) | Gira el vector de Bloch θ radianes alrededor de X. |
| RY(θ) | Gira el vector de Bloch θ radianes alrededor de Y. |
| RZ(θ) | Gira alrededor de Z. Multiplica las amplitudes por fases opuestas −θ/2 y +θ/2. |
| CNOT | Invierte el objetivo cuando el control vale 1. |
| CCNOT · Toffoli | Invierte el objetivo cuando ambos controles valen 1. |
| SWAP | Intercambia los estados de dos cúbits. |

**M** mide un cable y escribe el resultado en un bit clásico. **X|c** y **Z|c** se aplican si el bit elegido contiene 1. El circuito de teleportación usa estas correcciones para recuperar en q2 el estado preparado en q0.
