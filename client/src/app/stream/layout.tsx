import React, { ReactNode } from "react";
import MediaSoupProvider from "../providers/MediaSoupProvider";
import SocketProvider from "../providers/SocketProvider";

export default function StreamLayout({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <MediaSoupProvider>{children}</MediaSoupProvider>
    </SocketProvider>
  );
}
