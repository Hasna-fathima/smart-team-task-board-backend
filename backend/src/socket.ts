import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log('[Socket.io]: Client connected:', socket.id);

    // Join workspace room (for task/sprint real-time events)
    socket.on('join:workspace', (workspaceId: string) => {
      socket.join('workspace:' + workspaceId);
      console.log('[Socket.io]: Socket', socket.id, 'joined workspace:', workspaceId);
    });

    socket.on('leave:workspace', (workspaceId: string) => {
      socket.leave('workspace:' + workspaceId);
    });

    // Join personal user room for direct messages
    socket.on('join:user', (userId: string) => {
      if (userId) {
        socket.join('user:' + userId);
        console.log('[Socket.io]: Socket', socket.id, 'joined user room:', userId);
      }
    });

    socket.on('leave:user', (userId: string) => {
      if (userId) socket.leave('user:' + userId);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io]: Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = (): Server | null => {
  return io;
};