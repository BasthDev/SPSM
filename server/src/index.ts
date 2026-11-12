import { app } from './app';
import { config } from './config';

const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 SPSM-KU Backend API Server running on port ${PORT}`);
  console.log(`📍 Health Check: http://localhost:${PORT}/health`);
  console.log(`📍 Base API URL: http://localhost:${PORT}/api`);
  console.log(`===============================================`);
});
