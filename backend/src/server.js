import { createApp } from './app.js';
import { pool } from './config/db.js';

const port = Number(process.env.PORT || 5000);
const server = createApp().listen(port, () => console.log(`RetailIQ API listening on http://localhost:${port}`));

const shutdown = async () => { server.close(); await pool.end(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
