import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // In-memory database for shared state
  const db: Record<string, any> = {
    users: [],
    visits: [],
    coupons: [],
    tables: [],
    communications: [],
    tierOverrides: [],
    masterPassword: 'IMC'
  };

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send current state to the new client
    socket.emit('init_state', db);

    // Listen for state updates from clients
    socket.on('update_state', ({ key, value }) => {
      db[key] = value;
      // Broadcast to all OTHER connected clients
      socket.broadcast.emit('state_updated', { key, value });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
