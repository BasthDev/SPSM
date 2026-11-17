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

/**
 * Rate limiter untuk similarity check (memanggil Gemini API).
 * Mencegah abuse yang bisa menghabiskan kuota/biaya Gemini.
 * Window 1 menit, maks 10 request per IP.
 */
export const similarityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak pengecekan kemiripan. Tunggu sebentar.' },
});

/**
 * Rate limiter umum untuk endpoint non-auth — anti-scraping.
 * Window 1 menit, maks 120 request per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request. Coba lagi nanti.' },
});
