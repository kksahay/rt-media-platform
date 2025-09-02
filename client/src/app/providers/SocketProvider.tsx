"use client";

import { createContext, ReactNode, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useParticipantStore } from "../stores/participant";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export default function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const setSelf = useParticipantStore((state) => state.setSelf);

  useEffect(() => {
    const socket = io("ws://localhost:8080");
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
      setSelf(socket.id);
      setIsConnected(true);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);
  return (
    <SocketContext value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext>
  );
}
