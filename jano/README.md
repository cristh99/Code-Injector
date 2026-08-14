# JANO v1.0.0-experimental

JANO convierte un snapshot **read-only** del grafo de trabajo de EVIDENCIA_PUBLICA en un receipt determinista de reconsideración. Emite exactamente uno de estos veredictos por trabajo activo: `MATAR`, `CAMBIAR`, `MOVER`, `FUSIONAR`, `CREAR` o `SIN_CAMBIO`.

## Frontera con Neon

Neon ya posee el mutador canónico `agent_memory.record_work_relevance_decisions_v2`, reservado a `system:planner` dentro de un planning cycle válido. JANO es el preflight read-only y **no es una traducción automática** a `STILL_NEEDED`, `CANCEL_OBSOLETE`, `SATISFIED`, `SUPERSEDE`, `SPLIT` o `MERGE`; `MOVER` pertenece al scheduler/routing. JANO nunca invoca esa función.

## Evidencia publicada

El release exacto está conservado como chunks Base64 content-addressed. Reconstrucción:

```bash
cd jano/release
python reconstruct_release.py
```

- Resultado: `jano-v1.0.0-experimental.tar.gz`
- Bytes: `20,964`
- SHA-256: `334c369373b067ac1d810a718b0e1c584e69796b27a0b0ec6478bb50f82e4c4f`
- Manifest externo: `release/jano-v1.0.0-experimental.manifest.json`
- Manifest SHA-256: `0132ebde1006e99853e9e790b6b87c56a3beb91662c670802130c8c2e5486a2c`
- Canario vivo: `release/jano-live-canary-receipt.json`
- Pruebas locales y cold-run del tarball exacto: `23/23 PASS`
- Canario: 11 trabajos activos evaluados; `MATAR=4`, `CAMBIAR=4`, `MOVER=1`, `SIN_CAMBIO=2`; mutaciones `0`.

## Verificación

```bash
cd jano/release
python reconstruct_release.py
mkdir /tmp/jano
tar -xzf jano-v1.0.0-experimental.tar.gz -C /tmp/jano
cd /tmp/jano/jano-v1.0.0-experimental
PYTHONPATH=src python -m unittest discover -s tests -v
python -m compileall -q src scripts tests
```

## Frontera de seguridad

JANO sólo recomienda sobre el snapshot suministrado. No cambia estados, claims, assignments, dependencias, mensajes, páginas de Notion, repositorios ni proveedores; no cancela ni reasigna trabajo. La promoción o aplicación de cualquier veredicto requiere autorización y QA distintas. Producción permanece sin cambios, Basic Memory está prohibido y el gasto externo observado es `US$0`.
