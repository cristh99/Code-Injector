# JANO v1.0.0-experimental

JANO convierte un snapshot **read-only** del grafo de trabajo de EVIDENCIA_PUBLICA en un receipt determinista de reconsideración. Emite exactamente uno de estos veredictos por trabajo activo: `MATAR`, `CAMBIAR`, `MOVER`, `FUSIONAR`, `CREAR` o `SIN_CAMBIO`.

## Evidencia publicada

- Release reproducible: `release/jano-v1.0.0-experimental.tar.gz`
- Bytes: `19,973`
- SHA-256: `9afc412f9c02162a57a09721bb6c35cb1d5746c4659aa6192f88aaae91cc98b6`
- Manifest: `release/jano-v1.0.0-experimental.manifest.json`
- Canario vivo: `release/jano-live-canary-receipt.json`
- Pruebas locales y cold-run: `22/22 PASS`
- Canario: 11 trabajos activos evaluados; `MATAR=4`, `CAMBIAR=4`, `MOVER=1`, `SIN_CAMBIO=2`; mutaciones `0`.

## Verificación

```bash
mkdir /tmp/jano

tar -xzf release/jano-v1.0.0-experimental.tar.gz -C /tmp/jano
cd /tmp/jano/jano-v1.0.0-experimental

PYTHONPATH=src python -m unittest discover -s tests -v
python -m compileall -q src scripts tests
PYTHONPATH=src python -m jano.cli audit \
  --snapshot tests/fixtures/live_canary.json \
  --as-of 2026-08-14T01:46:00Z \
  --stale-hours 6 \
  --output /tmp/jano-receipt.json
```

## Frontera de seguridad

JANO sólo recomienda sobre el snapshot suministrado. No cambia estados, claims, assignments, dependencias, mensajes, páginas de Notion, repositorios ni proveedores; no cancela ni reasigna trabajo. La promoción o aplicación de cualquier veredicto requiere autorización y QA distintas. Producción permanece sin cambios, Basic Memory está prohibido y el gasto externo observado es `US$0`.
