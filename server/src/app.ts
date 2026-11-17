import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// Trust reverse proxy (Cloudflare Tunnel, Traefik, Nginx) for accurate IP rate-limiting
app.set('trust proxy', 1);

// CORS — whitelist hanya domain resmi & localhost dev
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  'https://dash.basthstudio.my.id',
  'https://spsm.basthstudio.my.id',
  'http://localhost:5173',
  'http://localhost:3000',
];

const corsOrigins = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;

app.use(
  cors({
    origin: (origin, cb) => {
      // Izinkan request tanpa origin (mis. mobile app, Postman, curl)
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin tidak diizinkan — ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'spsm-api-server',
    time: new Date().toISOString(),
  });
});

// Mount Universal API Routes
app.use('/api', routes);

// Centralized Error Handling Middleware
app.use(errorHandler);
