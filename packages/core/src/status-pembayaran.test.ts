import { describe, expect, it } from 'vitest';
import { statusPembayaran } from './status-pembayaran.js';

const tanpaKeringanan: never[] = [];

describe('statusPembayaran', () => {
  it('belum bayar — nol pembayaran, sisa penuh', () => {
    const st = statusPembayaran({
      statusTagihan: 'terbit',
      nominal: 450_000,
      keringanan: tanpaKeringanan,
      pembayaran: [],
    });
    expect(st.status).toBe('belum_bayar');
    if (st.status === 'belum_bayar') {
      expect(st.sisa).toBe(450_000);
      expect(st.sudahBayar).toBe(0);
    }
  });

  it('bayar sebagian — pembayaran kurang dari nominal', () => {
    const st = statusPembayaran({
      statusTagihan: 'terbit',
      nominal: 450_000,
      keringanan: tanpaKeringanan,
      pembayaran: [{ nominal: 150_000, tanggal: '2026-08-05' }],
    });
    expect(st.status).toBe('bayar_sebagian');
    if (st.status === 'bayar_sebagian') {
      expect(st.sudahBayar).toBe(150_000);
      expect(st.sisa).toBe(300_000);
    }
  });

  it('sudah bayar — total pas nominal, lunasPada = pembayaran terakhir', () => {
    const st = statusPembayaran({
      statusTagihan: 'terbit',
      nominal: 450_000,
      keringanan: tanpaKeringanan,
      pembayaran: [
        { nominal: 150_000, tanggal: '2026-08-05' },
        { nominal: 300_000, tanggal: '2026-08-12' },
      ],
    });
    expect(st.status).toBe('sudah_bayar');
    if (st.status === 'sudah_bayar') {
      expect(st.totalBayar).toBe(450_000);
      expect(st.lunasPada).toBe('2026-08-12');
    }
  });

  it('sudah bayar — lebih bayar tetap lunas', () => {
    const st = statusPembayaran({
      statusTagihan: 'lunas',
      nominal: 450_000,
      keringanan: tanpaKeringanan,
      pembayaran: [{ nominal: 495_000, tanggal: '2026-08-10' }],
    });
    expect(st.status).toBe('sudah_bayar');
    if (st.status === 'sudah_bayar') {
      expect(st.totalBayar).toBe(495_000);
      expect(st.lunasPada).toBe('2026-08-10');
    }
  });

  it('keringanan mempengaruhi sisa', () => {
    const st = statusPembayaran({
      statusTagihan: 'terbit',
      nominal: 450_000,
      keringanan: [{ nominal: null, persentase: 10 }],
      pembayaran: [{ nominal: 300_000, tanggal: '2026-08-12' }],
    });
    // 450.000 - 45.000 (10%) - 300.000 = 105.000 sisa
    expect(st.status).toBe('bayar_sebagian');
    if (st.status === 'bayar_sebagian') {
      expect(st.sisa).toBe(105_000);
    }
  });

  it('dibatalkan — status khusus', () => {
    const st = statusPembayaran({
      statusTagihan: 'dibatalkan',
      nominal: 450_000,
      keringanan: tanpaKeringanan,
      pembayaran: [],
    });
    expect(st.status).toBe('dibatalkan');
  });
});
