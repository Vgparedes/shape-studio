# Shape Studio

Generador de ilustraciones vectoriales de KRSp. La idea final es describir con texto lo que se quiere ("cinco girasoles de perfil mirando a la derecha") y que la app lo construya con geometría procedural, en SVG real y editable.

Todo corre en el navegador. Los proyectos se guardan en este navegador (IndexedDB) y no se suben a ningún lado.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # chequea tipos y arma dist/
```

## Arquitectura

```
src/
  core/                 modelo del documento (escena, nodos, transformaciones), azar con semilla y colores
  engine/
    geometry/           Procedural Generation Engine
      path.ts           primitivas: polígonos, curvas suaves (Catmull-Rom → Bézier), elipses...
      vec.ts            vectores 2D y 3D
      noise.ts          ruido suave con semilla, 1D y 2D (ondulaciones, campos de flujo)
      curve.ts          curvas que crecen cambiando de rumbo (tallos, ramas, raíces), con tropismo
      ribbon.ts         cintas: línea central → forma rellena de grosor variable
      branching.ts      ramificación recursiva (árboles, raíces), con tope de segmentos
    organic/shapes.ts   Organic Shape Engine: blobs (radio por armónicos) y superfórmula
    botanical/          Botanical Engine
      leaf.ts           hojas y pétalos: perfiles de forma, curvatura, borde dentado, nervaduras
      flowerHead.ts     cabeza de flor en 3D proyectada (de frente, perfil, tres cuartos, cabizbaja)
      plant.ts          tallo + hojas + raíces y los parámetros que comparten las plantas
    generators/         Shape Library: cada generador declara categoría, parámetros y palabras clave
      types.ts          el contrato Generator
      index.ts          registro + crear / regenerar nodos
      build.ts          ayudas para armar nodos y estilos
      geometry.ts       geometría: rectángulo, círculo, polígono, estrella, arco, espiral, concéntricas, red, fractal
      organic.ts        blob, forma fluida, silueta irregular, geometría orgánica, ondas, curvas fluidas, cinta, composición abstracta
      botanical.ts      girasol, margarita, flor, tulipán, hoja, rama, raíces, árbol, helecho
      agro.ts           espiga de trigo, planta de maíz
  render/svg.ts         Rendering Engine: escena → SVG (lo usan el lienzo, las miniaturas y la exportación)
  render/measure.ts     mide figuras con el motor SVG del navegador (centrar y encuadrar)
  export/export.ts      Export Engine: SVG, PNG y WEBP
  projects/             Project Manager: IndexedDB, autoguardado, proyecto de ejemplo
  state/                estado (zustand): documento, selección, deshacer/rehacer, vista del lienzo
  ui/                   interfaz
```

**Cómo se suma una figura nueva:** se escribe un objeto `Generator` (id, categoría, lista de parámetros y una función `generate` que devuelve un path o un grupo alrededor de (0, 0)) y se registra en `engine/generators/index.ts`. La biblioteca, el panel de parámetros, la semilla, el guardado y la exportación lo toman solos.

Cada nodo generado guarda `source = { generator, params, seed }`. Por eso se puede regenerar con otros parámetros u otra semilla sin perder la posición ni los colores, y es la base para la edición por prompts ("hacé las hojas más chicas" = cambiar un parámetro y regenerar).

Las plantas separan sus partes en grupos con nombre y un `role` (`petals`, `center`, `stem`, `leaves`, `roots`...). Los parámetros también van agrupados por parte (`group`), y el panel los muestra así. La edición por prompts va a usar ambas cosas para tocar solo lo que se pide.

Módulos que llegan en las próximas etapas: Prompt Interpreter, Style Engine y Composition Engine (la composición abstracta ya trae una versión simple de ubicación con equilibrio).

## Etapas

| Etapa | Estado |
|---|---|
| 1. Interfaz, lienzo y proyectos | ✓ Hecha |
| 2. Motor procedural y geometría SVG | ✓ Hecha |
| 3. Generadores botánicos | ✓ Hecha (11 figuras, incluye agro) |
| 4. Generadores abstractos y geométricos | ✓ Hecha |
| 5. Biblioteca de categorías | Pendiente |
| 6. Estilos visuales | Pendiente |
| 7. Prompts (reglas locales + Ollama opcional) | Pendiente |
| 8. Variaciones y edición conversacional | Pendiente |
| 9. Editor manual completo | Parcial (mover, capas, deshacer) |
| 10. Referencias visuales y exportación | Exportación SVG / PNG / WEBP hecha |

### Etapa 1: qué hay

- **Lienzo:** mesa de trabajo con medida en px, zoom (Ctrl + rueda, pellizco o botones), desplazamiento (arrastrar el fondo, rueda o espacio + arrastrar), selección (Mayús para sumar) y mover arrastrando.
- **Biblioteca:** rectángulo, círculo / elipse, polígono (con redondeo e irregularidad), estrella, espiral (arquimediana o logarítmica) y figuras concéntricas (grupo).
- **Propiedades:** parámetros del generador con regeneración en vivo, semilla (fija o "Otra semilla"), posición, rotación, escala, opacidad, relleno, trazo y grosor. Sin selección: tamaño y fondo del documento (o transparente).
- **Capas:** árbol con grupos, renombrar (doble clic), ocultar, bloquear, subir y bajar.
- **Proyectos:** autoguardado, varios proyectos con miniatura, nuevo, abrir, duplicar, borrar (con confirmación) y versiones guardadas que se pueden restaurar.
- **Deshacer / rehacer** (Ctrl + Z, Ctrl + Shift + Z o Ctrl + Y). Arrastres y sliders cuentan como un solo paso.
- **Atajos:** Supr para borrar, Ctrl + D para duplicar, flechas para mover (Mayús = 10 px), Esc para soltar la selección.
- **Exportar:** SVG con paths reales y capas con nombre; PNG y WEBP con ancho a elección y fondo transparente opcional.

### Etapas 2 y 3: qué hay

- **Motor procedural:** curvas que crecen con curvatura, ondulación y tropismo; ruido con semilla; cintas de grosor variable; ramificación recursiva; proyección 3D para flores.
- **Botánica:** girasol, margarita, flor genérica, tulipán, hoja, rama con hojas, raíces, árbol (copas, hojas o solo ramas) y helecho (con pínnulas).
- **Agro:** espiga de trigo (una o varias, con barbas) y planta de maíz (caña con nudos, hojas arqueadas, panoja, choclos con chala). El girasol y las raíces también aparecen en Agro.
- **Control por partes:** en las flores, por ejemplo, Flor (orientación, inclinación, desorden), Pétalos (cantidad, largo, ancho, forma, coronas, copa), Centro (tamaño, posición, semillas, brácteas), Tallo, Hojas (cantidad, forma, distribución alterna u opuesta, ángulo, caída, nervaduras, borde dentado), Raíces y Colores por parte.
- **Orientación real:** la flor se puede girar a la derecha o a la izquierda y poner cabizbaja. Los pétalos de adelante y de atrás se ordenan por profundidad.
- **Siluetas limpias:** troncos, raíces, copas y helechos se dibujan con contorno solo por fuera (`paint-order`). Inkscape, Figma y los navegadores lo respetan. Illustrator puede mostrar las uniones internas.
- **Al sumar una figura** se centra según lo que ocupa realmente y, si no entra, se achica.
- **Topes de rendimiento:** la ramificación corta en 1500 segmentos y el follaje se reparte para que el SVG no explote.

**Pendiente de botánica para la etapa 5:** rosa, hongos, cactus, suculentas, frutas, verduras, semillas sueltas, hierbas y enredaderas.

### Etapa 4: qué hay

- **Formas orgánicas:** blob, forma fluida (gota), silueta irregular y geometría orgánica (superfórmula). Todas comparten controles de vértices, suavidad, irregularidad, simetría, complejidad, proporción y "cola" para estirar un lado.
- **Ondas:** como líneas o como bandas de color, con amplitud, largo de onda, desfase, crecimiento e irregularidad.
- **Curvas fluidas:** trazos que siguen un campo de flujo invisible y se afinan en las puntas.
- **Cinta:** ondula y se retuerce, con la cara de adelante y la de atrás en colores distintos.
- **Composición abstracta:** formas mixtas, orgánicas o geométricas, con cantidad, distribución (libre, agrupada, en fila, diagonal o círculo), separación, escala, rotación, equilibrio visual y espacio negativo. Paleta de 4 colores (por defecto, verde oliva, beige, mostaza y oscuro).
- **Geometría nueva:** arco con grosor, red geométrica (cuadrada, triangular o panal, con nodos y deformación) y fractales (copo de Koch, triángulo y alfombra de Sierpinski, curva del dragón).
- Los fractales tienen tope de profundidad por tipo y las curvas fluidas, tope de puntos, para que el SVG siga siendo manejable.
