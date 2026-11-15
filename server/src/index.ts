// Node <22 tidak punya global EventSource — dibutuhkan PocketBase realtime (SSE)
import { EventSource as PolyfillEventSource } from 'eventsource';
if (typeof (globalThis as any).EventSource === 'undefined') {
  (globalThis as any).EventSource = PolyfillEventSource;
}

import { app } from './app';
import { config } from './config';
import { startPeriodWatcher } from './services/periodWatcher';
import { attachRealtimeBridge } from './services/realtimeBridge';

const PORT = config.port;

startPeriodWatcher();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 SPSM-KU Backend API Server running on port ${PORT}`);
  console.log(`📍 Health Check: http://localhost:${PORT}/health`);
  console.log(`📍 Base API URL: http://localhost:${PORT}/api`);
  console.log(`===============================================`);
});

attachRealtimeBridge(server);
