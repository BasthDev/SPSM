import rateLimit from 'express-rate-limit';

/**
 * Rate limiter untuk endpoint auth — mencegah brute-force login.
 * Window 15 menit, maks 30 request per IP per window.
 * Di belakang NAT/wifi kampus banyak user bisa share IP — 30 cukup longgar
 * untuk pemakaian normal (login + oauth-session per sesi), tapi menahan
 * serangan credential stuffing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
});
