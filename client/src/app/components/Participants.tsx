"use client";

import { useEffect, useRef } from "react";
import { useParticipantStore } from "../stores/participant";
import Participant from "./Participant";
import { Producer, Consumer } from "mediasoup-client/types";

export default function Participants() {
  const participants = useParticipantStore((state) => state.participants);
  const producers = useParticipantStore((state) => state.producers);
  const self = useParticipantStore((state) => state.self);
  const localStream = useParticipantStore((state) => state.localStream);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const getGridCols = (count: number) => {
    if (count <= 1) return "grid-cols-1";
    if (count <= 2) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 sm:grid-cols-3";
    if (count <= 12) return "grid-cols-3 sm:grid-cols-4";
    return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5";
  };

  useEffect(() => {
    if (!videoRef.current) return;

    if (localStream) {
      videoRef.current.srcObject = localStream;
    } else {
      videoRef.current.srcObject = null;
    }
    videoRef.current
      .play()
      .catch((error) => console.log("audioElem.play() failed:%o", error));
  }, [localStream, participants]);

  return (
    <div className="flex-1 p-3 overflow-hidden">
      <div
        className={`h-full grid ${getGridCols(
          Object.keys(participants).length + 1
        )} gap-2`}
      >
        <video
          autoPlay
          playsInline
          muted
          ref={videoRef}
          className="w-full h-full object-cover bg-gray-200"
        />

        {Object.entries(participants).map(([id, consumers]) => (
          <Participant key={id} id={id} consumers={consumers} />
        ))}
      </div>
    </div>
  );
}
