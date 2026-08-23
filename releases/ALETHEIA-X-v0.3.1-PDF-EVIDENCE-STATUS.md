# ALETHEIA X v0.3.1 — PDF evidence status

**Status:** `ACQUISITION_COMPATIBILITY_ONLY__PDF_EVIDENCE_BLOCKED`

## Valid surface

The content-addressed v0.3.1 executable may still be used for bounded:

- keyless web search;
- native HTTP fetch;
- direct CDP/browser navigation;
- official-page discovery;
- official download-link discovery;
- byte acquisition, MIME/magic checks, and hashing;
- fail-closed acquisition behavior.

## Blocked surface

The current sovereign canary installs and uses `pdftotext` and historically accepted `official_pdf_text_markers`. That output is **not authoritative PDF evidence** under the current EVIDENCIA_PUBLICA policy.

Do not use v0.3.1 native PDF text to assert:

- material presence or absence;
- quotations or semantic claims;
- identity, date, money, legal, delivery, liquidation, or wrongdoing findings;
- complete-document coverage.

## Successor gate

A PDF evidence successor must provide and independently verify:

1. exact source bytes and SHA-256;
2. page count from the exact file;
3. render of every page;
4. OCR of every page;
5. `ocr_used=true`;
6. `ocr_pages == page_count`;
7. `native_pdf_text_ignored=true`;
8. `provenance=PAGE_RENDER_OCR`;
9. page/region/span anchors sufficient to return every material claim to the rendered source;
10. negative controls proving that legacy native-text markers cannot produce PASS.

Until those conditions pass, the workflow is intentionally fail-closed at the PDF OCR evidence gate. Acquisition outputs remain useful but their claim ceiling is limited to discovery and exact-byte custody.
