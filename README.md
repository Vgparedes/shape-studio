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
    geometry/flatten.ts recorre cualquier path SVG (curvas, arcos, relativos) y lo pasa a polilíneas
    style/              Style Engine
      geometry.ts       adentro/afuera, tramos (scanline), grillas, tramas, simplificación, ondulado
      styles.ts         los 20 estilos
      index.ts          aplica el estilo al dibujar y exportar, con caché
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
      kit.ts            atajos para generadores: siluetas por perfil, círculos, orientación de contornos, nodos con estilo
      botanicalExtra.ts rosa, hongo, cactus, suculenta, frutas y verduras, semillas, pasto, enredadera
      landscape.ts      montañas, colinas y campos, nubes, sol, luna, agua, dunas, rocas, fuego, hielo, planeta
      animals.ts        ave, mariposa, insectos, pez, cuadrúpedo, lagartija
      objects.ts        casa, edificio, ventana, puerta, puente, torre, mueble, recipiente, herramienta, engranaje, silo/molino/tanque
      symbols.ts        mandala, marco, emblema, ornamento, composición simétrica
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

Módulos que llegan en las próximas etapas: Prompt Interpreter y Composition Engine (la composición abstracta ya trae una versión simple de ubicación con equilibrio).

## Etapas

| Etapa | Estado |
|---|---|
| 1. Interfaz, lienzo y proyectos | ✓ Hecha |
| 2. Motor procedural y geometría SVG | ✓ Hecha |
| 3. Generadores botánicos | ✓ Hecha (11 figuras, incluye agro) |
| 4. Generadores abstractos y geométricos | ✓ Hecha |
| 5. Biblioteca de categorías | ✓ Hecha (69 figuras en 8 categorías) |
| 6. Estilos visuales | ✓ Hecha (20 estilos) |
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

### Etapa 5: qué hay

**69 figuras** en 8 categorías (algunas aparecen en dos, por ejemplo el girasol en Botánica y en Agro). La biblioteca tiene **buscador** que no distingue tildes y busca en nombre, descripción y palabras clave.

- **Botánica, segunda tanda:** rosa (abierta o capullo), hongo (sombreros variados, en grupo), cactus (columnar, barril o nopal, con maceta), suculenta, frutas y verduras (10 tipos), semillas y granos (pipa de girasol, maíz, poroto, almendra, trigo), pasto y hierbas, enredadera.
- **Paisaje:** montañas con nieve, colinas y campos con surcos, nubes, sol, luna con fases, río, lago o gota, dunas, piedras, fuego o fogata, copo de nieve o cristales, planeta con anillo.
- **Animales:** ave (posada o volando), mariposa, insectos (abeja, escarabajo, hormiga, vaquita), pez, cuadrúpedo en silueta (perro, gato, caballo, ciervo, vaca o a medida) y lagartija. Las figuras de perfil pueden mirar a la derecha o a la izquierda.
- **Arquitectura y objetos:** casa, edificio, ventana, puerta, puente (arcos, colgante, vigas), torre, mueble, recipiente (jarrón, ánfora, maceta, botella, taza, frasco, cuenco), herramienta, engranaje y, para el campo, silo, molino o tanque australiano.
- **Símbolos y ornamentos:** mandala, marco, emblema o escudo, ornamento (volutas) y composición simétrica. La estrella, el sol, la luna, el fuego, el hielo y el engranaje también aparecen acá.
- **Detalle técnico:** cuando varias formas van en un mismo path, todos los contornos se orientan en el mismo sentido (`clockwise` en kit.ts). Si no, donde se superponen aparecen agujeros.

**Pendiente para más adelante (no bloquea):** más animales (mamíferos detallados, reptiles de perfil), más objetos cotidianos y más tipos de herramientas.

### Etapa 6: qué hay

**20 estilos** en la pestaña *Estilos* del panel izquierdo, cada uno con vista previa real: Line Art, Outline, Solid, Minimalist, Botanical, Geometric, Organic, Dotwork, Stippling, Halftone, Engraving, Sketch, Hand Drawn, Vintage, Technical Illustration, Monochrome, Flat Illustration, Duotone, Isometric y Abstract.

- **Rehacen la geometría, no solo el color.** Por ejemplo:
  - Dotwork rellena con puntos que crecen en la sombra.
  - Engraving traza líneas paralelas que engordan en las zonas oscuras, con contrahachurado.
  - Geometric pasa las curvas a facetas.
  - Isometric lleva la figura a 30° y le da espesor.
  - Technical agrega cotas y ejes.
- **No destructivos.** El estilo se guarda aparte de la figura (`fx` en el nodo) y se aplica al dibujar y al exportar. Se puede cambiar, ajustar o sacar sin perder la figura ni sus parámetros. Si después regenerás la figura (otra semilla, más pétalos), el estilo se vuelve a aplicar solo.
- **Se aplica a lo seleccionado, o a todas las figuras** si no hay nada seleccionado. Cada estilo tiene sus parámetros en *Propiedades* (densidad, ángulo de la trama, dirección de la luz, tinta única o color de cada parte, fondo de papel), más "Otra variación del estilo" y "Quitar estilo". Todo se puede deshacer.
- **Luz y sombreado.** Los estilos de puntos y tramas usan el tono de cada parte más un degradé de luz (ángulo configurable). Así la sombra cae de un lado, como en un grabado.
- **Exportación.** El SVG sale con la geometría estilizada real (paths), sin imágenes adentro.
- **Rendimiento.** Los paths se recorren y se recortan en JavaScript puro (scanline con regla nonzero), sin consultar al navegador punto por punto. Un girasol con Dotwork o Engraving tarda unos 15 ms. Además, el lienzo se redibuja con prioridad baja para que los sliders no se traben.
- **Para tener en cuenta:** Monochrome y Duotone trabajan sobre todo con el color: Duotone suma trama de puntos solo en los medios tonos y Monochrome agrupa los tonos en niveles.
