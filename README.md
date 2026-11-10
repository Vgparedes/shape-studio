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
  core/                 modelo del documento (escena, nodos, transformaciones) y azar con semilla
  engine/
    geometry/path.ts    primitivas: polígonos, curvas suaves (Catmull-Rom → Bézier), elipses...
    generators/         Shape Library: cada generador declara categoría, parámetros y palabras clave
      types.ts          el contrato Generator
      index.ts          registro + crear / regenerar nodos
      geometry.ts       generadores geométricos (etapa 1)
  render/svg.ts         Rendering Engine: escena → SVG (lo usan el lienzo, las miniaturas y la exportación)
  export/export.ts      Export Engine: SVG, PNG y WEBP
  projects/             Project Manager: IndexedDB, autoguardado, proyecto de ejemplo
  state/                estado (zustand): documento, selección, deshacer/rehacer, vista del lienzo
  ui/                   interfaz
```

**Cómo se suma una figura nueva:** se escribe un objeto `Generator` (id, categoría, lista de parámetros y una función `generate` que devuelve un path o un grupo alrededor de (0, 0)) y se registra en `engine/generators/index.ts`. La biblioteca, el panel de parámetros, la semilla, el guardado y la exportación lo toman solos.

Cada nodo generado guarda `source = { generator, params, seed }`. Por eso se puede regenerar con otros parámetros u otra semilla sin perder la posición ni los colores, y es la base para la edición por prompts ("hacé las hojas más chicas" = cambiar un parámetro y regenerar).

Módulos que llegan en las próximas etapas: Prompt Interpreter, Botanical Engine, Organic Shape Engine, Style Engine y Composition Engine.

## Etapas

| Etapa | Estado |
|---|---|
| 1. Interfaz, lienzo y proyectos | ✓ Hecha |
| 2. Motor procedural y geometría SVG | Base hecha (primitivas, registro de generadores, semillas) |
| 3. Generadores botánicos | Pendiente |
| 4. Generadores abstractos y geométricos | Geometría básica hecha; faltan los orgánicos |
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
