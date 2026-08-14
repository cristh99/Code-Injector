# JANO v1.0.0-experimental

JANO convierte un snapshot **read-only** del grafo de trabajo de EVIDENCIA_PUBLICA en un receipt determinista de reconsideración. Emite exactamente uno de estos veredictos por trabajo activo: `MATAR`, `CAMBIAR`, `MOVER`, `FUSIONAR`, `CREAR` o `SIN_CAMBIO`.

## Frontera con Neon

Neon ya posee el mutador canónico `agent_memory.record_work_relevance_decisions_v2`, reservado a `system:planner` dentro de un planning cycle válido. JANO es el preflight read-only y **no es una traducción automática** a `STILL_NEEDED`, `CANCEL_OBSOLETE`, `SATISFIED`, `SUPERSEDE`, `SPLIT` o `MERGE`; `MOVER` pertenece al scheduler/routing. JANO nunca invoca esa función.

## Evidencia publicada

El release exacto está conservado como ocho chunks Base64 content-addressed. Reconstrucción:

```bash
cd jano/release
python reconstruct_release.py
```

- Resultado: `jano-v1.0.0-experimental.tar.gz`
- Bytes: `21,225`
- SHA-256: `2f5442434e5913b03b40bac85a1e76d6ff0da44b8770e1a4381e7faad00e6cc7`
- Manifest externo: `release/jano-v1.0.0-experimental.manifest.json`
- Manifest SHA-256: `05c0033fb2abb8a9be0f96f7bfdc9e632c094c0b19e650311d00b7480f8b3e34`
- Canario vivo: `release/jano-live-canary-receipt.json`
- Pruebas locales y cold-run del tarball exacto: `24/24 PASS`
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
python scripts/build_release.py --root . --out-dir /tmp/rebuild
cmp /tmp/rebuild/jano-v1.0.0-experimental.tar.gz ../../../../jano/release/jano-v1.0.0-experimental.tar.gz
```

La última prueba demuestra que una reconstrucción desde el propio release vuelve a producir exactamente el mismo tar y contiene un solo `MANIFEST.json`.

## Frontera de seguridad

JANO sólo recomienda sobre el snapshot suministrado. No cambia estados, claims, assignments, dependencias, mensajes, páginas de Notion, repositorios ni proveedores; no cancela ni reasigna trabajo. La promoción o aplicación de cualquier veredicto requiere autorización y QA distintas. Producción permanece sin cambios, Basic Memory está prohibido y el gasto externo observado es `US$0`.
