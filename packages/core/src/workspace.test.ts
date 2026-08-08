import { describe, expect, it } from 'vitest';
import { PAKET } from '@siakad/contracts';

/**
 * Uji kabel workspace, bukan uji fitur.
 *
 * Tujuannya membuktikan satu hal yang mudah rusak diam-diam: paket lain benar-benar
 * bisa meng-import `@siakad/contracts`. Bila npm workspaces atau referensi tsconfig
 * salah pasang, build tetap bisa lolos sementara import gagal saat dijalankan.
 */
describe('kabel workspace', () => {
  it('paket lain dapat meng-import @siakad/contracts', () => {
    expect(PAKET).toBe('contracts');
  });
});
