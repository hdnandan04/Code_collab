import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initializeSocket = (roomId: string, username: string): Socket => {
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
  
  socket = io(SOCKET_URL, {
    query: { roomId, username },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Event emitters
export const emitCodeChange = (roomId: string, code: string) => {
  socket?.emit("code-change", { roomId, code });
};

export const emitChatMessage = (roomId: string, message: any) => {
  socket?.emit("chat-message", { roomId, message });
};

export const emitCursorPosition = (roomId: string, position: any) => {
  socket?.emit("cursor-position", { roomId, position });
};

export const requestCodeSnapshot = (roomId: string) => {
  socket?.emit("request-snapshot", { roomId });
};
