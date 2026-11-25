# Mardel Movilidad — PWA de prueba

Versión estática e instalable para probar estimaciones de paso de colectivos en Mar del Plata. Usa el feed GTFS público incluido como datos estáticos; no conecta GPS de colectivos ni API municipal en vivo y no considera accidentes, cortes ni tráfico. Los tiempos pueden variar.

## Funciones de esta prueba

- Selección de las líneas y servicios incluidos en el feed GTFS.
- Solicitud opcional de ubicación para ordenar las paradas de la línea por cercanía. La ubicación se procesa localmente en el dispositivo y no se transmite.
- Estimaciones aproximadas por frecuencia GTFS cuando hay viajes/frecuencias para la parada seleccionada.
- Manifest y service worker para instalarla como PWA y conservar la app y el feed en caché.
- Enlace de cada punto al mapa de OpenStreetMap.

No equivale a la aplicación web completa del repositorio principal: es un preview estático para validar la instalación y el flujo de estimaciones. No representa al Municipio ni es un sistema oficial de horarios.

## Datos y licencia

El feed GTFS se distribuye en `data/gtfs/` y se atribuye a Bondi MDP, proyecto abierto de Mar del Plata. El proyecto fuente declara feed con cobertura 2026-05-06 a 2027-05-06. La app fuente está publicada bajo MIT; ver `LICENSE` y el repositorio [cuando-llega-mi-bondi](https://github.com/cuando-llega-mi-bondi/cuando-llega-mi-bondi).

## Probar

Abrir el enlace de GitHub Pages en Chrome Android. Para instalar, usar el aviso «Instalar» del navegador/app o el menú del navegador → «Instalar aplicación» / «Agregar a pantalla principal». HTTPS es necesario para geolocalización y service worker.
