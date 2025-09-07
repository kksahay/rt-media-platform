"use client";

import { useEffect, useRef } from "react";
import { Consumer } from "mediasoup-client/types";

type Props = {
  id?: string;
  self?: boolean;
  consumers?: (Consumer | undefined)[];
};

export default function Participant({
  id,
  self,
  consumers = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const stream = new MediaStream();

    consumers.forEach((consumer) => {
      if (consumer?.track) {
        stream.addTrack(consumer.track);
      }
    });

    videoRef.current.srcObject = stream;
  }, [consumers]);

  return (
    <div className="w-full h  -full bg-gray-100 relative overflow-hidden">
      <video
        autoPlay
        playsInline
        ref={videoRef}
        className="w-full h-full object-cover bg-gray-200"
      />
      <div className="absolute bottom-2 left-2 text-xs bg-black text-white px-2 py-1 rounded">
        {self ? `You ${id}` : `User ${id}`}
      </div>
    </div>
  );
}
