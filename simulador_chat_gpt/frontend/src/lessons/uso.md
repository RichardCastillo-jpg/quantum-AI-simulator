## Construye y comprueba un circuito

1. Abre **Simulador → Configuración**. Elige el número de cúbits e introduce su cadena inicial. En la cadena 001, q0 empieza en 1.
2. Selecciona una compuerta y pulsa una celda, o arrástrala directamente. Para CNOT elige primero el control y luego el objetivo. Para Toffoli elige los dos controles y finalmente el objetivo. La primera celda fija el paso de inserción.
3. Observa el histograma y rota una esfera de Bloch arrastrándola. Cambia al modo Shot para comparar las frecuencias observadas con las probabilidades teóricas.
4. Selecciona un paso para editarlo, moverlo o eliminarlo. Arrástralo a la posición anterior al paso de destino. El extremo derecho inserta al final. Mayús + clic incorpora otros pasos a la selección.
5. Selecciona los extremos de una secuencia y pulsa **Crear ciclo**. Para guardar una rutina, selecciona las operaciones deseadas y pulsa **Guardar subcircuito**. Sin selección se guarda el circuito entero. Los cables utilizados se numeran localmente desde cero en orden ascendente.
6. Inserta el bloque y elige los cables del circuito en el orden de sus índices locales. El menú ⋯ permite inspeccionar sus capas y editar la definición compartida.
7. En **Algoritmos**, compara las cuatro funciones del oráculo de Deutsch. Tras una consulta, q0 vale 0 para una función constante y 1 para una balanceada. En teleportación, inserta RY antes del primer paso para preparar un estado distinto en q0 y comprueba el vector final de q2.
