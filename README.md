# Mardel Movilidad — PWA de prueba

Versión estática e instalable para probar estimaciones de paso de colectivos en Mar del Plata. Usa el feed GTFS público incluido como datos estáticos; no conecta GPS de colectivos ni API municipal en vivo y no considera accidentes, cortes ni tráfico. Los tiempos pueden variar.

## Funciones de esta prueba

- Selección de las líneas y servicios incluidos en el feed GTFS.
- Estimaciones aproximadas identificadas por destino/sentido cuando el GTFS publica una frecuencia; otros destinos se marcan sin estimación.
- Solicitud opcional de ubicación para ordenar las paradas de la línea por cercanía. La ubicación se procesa localmente en el dispositivo y no se transmite.
- Estimaciones aproximadas por frecuencia GTFS, separadas por el destino que informa el feed (por ejemplo, «Hacia Al Puerto»). Los destinos sin frecuencia publicada se identifican sin inventar una espera.
- Lista de paradas completa con botón «Ver más», agrupando los puntos duplicados de una misma esquina.
- Manifest y service worker para instalarla como PWA y conservar la app y el feed en caché.
- Direcciones de esquina para las paradas cuando coinciden con los datos de calles y paradas del proyecto original; no se inventa la altura numérica cuando no está en la fuente.
- Enlaces de cada punto a la aplicación de mapas del teléfono y a Google Maps web.

Las direcciones derivan de los ficheros estáticos de paradas/recorridos de Mardel Movilidad y Bondi MDP, cruzados con las coordenadas del feed GTFS. La cobertura no es total: cuando no hay coincidencia fiable se indica que la esquina no está identificada. La línea 554 tiene paradas estáticas de referencia, pero este GTFS no trae sus horarios; las líneas sin datos de paradas aparecen sin lista.

No equivale a la aplicación web completa del repositorio principal: es un preview estático para validar la instalación y el flujo de estimaciones. No representa al Municipio ni es un sistema oficial de horarios.

## Datos y licencia

El feed GTFS se distribuye en `data/gtfs/` y se atribuye a Bondi MDP, proyecto abierto de Mar del Plata. El proyecto fuente declara feed con cobertura 2026-05-06 a 2027-05-06. La app fuente está publicada bajo MIT; ver `LICENSE` y el repositorio [cuando-llega-mi-bondi](https://github.com/cuando-llega-mi-bondi/cuando-llega-mi-bondi).

## Probar

Abrir el enlace de GitHub Pages en Chrome Android. Para instalar, usar el aviso «Instalar» del navegador/app o el menú del navegador → «Instalar aplicación» / «Agregar a pantalla principal». HTTPS es necesario para geolocalización y service worker.
