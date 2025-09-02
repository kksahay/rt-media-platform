"use client";

import { useEffect, useRef } from "react";

type Props = {
  id?: string;
  self?: boolean;
  producers?: any[];
  consumers?: any[];
};

export default function Participant({
  id,
  self,
  producers = [],
  consumers = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const stream = new MediaStream();

    producers.forEach((producer) => {
      if (producer.track) {
        stream.addTrack(producer.track);
      }
    });

    consumers.forEach((consumer) => {
      if (consumer.track) {
        stream.addTrack(consumer.track);
      }
    });

    videoRef.current.srcObject = stream;
  }, []);

  return (
    <div className="w-full h-full bg-gray-100 relative overflow-hidden">
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
