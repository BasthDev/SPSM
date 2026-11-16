import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// Trust reverse proxy (Cloudflare Tunnel, Traefik, Nginx) for accurate IP rate-limiting
app.set('trust proxy', 1);

// Middlewares
app.use(cors());
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
