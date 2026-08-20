/**
 * Analisis chat terpagar (RFC-016) — deterministik dulu, LLM menyusul.
 *
 * `analisis_log` = jejak append-only setiap permintaan analisis: siapa, tool apa,
 * parameter (JSON), dan hasil ringkas (JSON). Semua interaksi analisis harus
 * tercatat (RFC-016 butir 7) — transparansi & kelak jadi bahan "promosi ke menu".
 */
export const DDL_ANALISIS: string = `
CREATE TABLE analisis_log (
  id        TEXT PRIMARY KEY,
  aktor_id  TEXT NOT NULL,
  tool      TEXT NOT NULL,
  parameter TEXT NOT NULL,
  hasil     TEXT NOT NULL,
  waktu     TEXT NOT NULL
) STRICT;
`;
