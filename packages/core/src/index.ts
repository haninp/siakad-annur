/**
 * `@siakad/core` — aturan bisnis dan penegakan izin.
 *
 * Satu-satunya tempat aturan izin ditegakkan (AGENTS.md). Bot dan MCP server
 * sama-sama memanggilnya; aturan yang sama tidak boleh hidup di dua tempat.
 */

export * from './izin.js';
