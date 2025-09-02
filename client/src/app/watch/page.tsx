"use client";
import { use, useEffect } from "react";
import { SocketContext } from "../providers/SocketProvider";

export default function Page() {
  const { socket, isConnected } = use(SocketContext);

  useEffect(() => {
    if (!socket || !isConnected) return;
    if (window.location.pathname !== "/watch") return;
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");

    if (!roomId) {
      return;
    }
    socket.emit("joinRoom", { roomId, viewMode: true });
    return () => {
      socket.off("joinRoom");
    };
  }, [isConnected]);

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex items-center justify-between p-2 border-b border-gray-200">
        <h1 className="text-lg font-medium text-black">HLS</h1>
      </div>
      <div className="flex-1 p-3 overflow-hidden">
          <div className="w-full h-full bg-gray-100 relative overflow-hidden">
            <video
              autoPlay
              playsInline
              // ref={videoRef}
              className="w-full h-full object-cover bg-gray-200"
            />
          </div>
        </div>
    </div>
  );
}
