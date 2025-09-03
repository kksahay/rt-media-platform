"use client";

import { use, useEffect, useState } from "react";
import SocketProvider from "../providers/SocketProvider";
import { useParticipantStore } from "../stores/participant";
import Participants from "../components/Participants";
import MediaSoupProvider, {
  MediaSoupContext,
} from "../providers/MediaSoupProvider";

export default function Stream() {
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const addProducer = useParticipantStore((state) => state.addProducer);
  const { sendTransport, isReady } = use(MediaSoupContext);
  const setLocalStream = useParticipantStore((state) => state.setLocalStream);

  function toggleMic() {
    setIsMicOn(!isMicOn);
  }
  function toggleVideo() {
    setIsVideoOn(!isVideoOn);
  }

  useEffect(() => {
    if (!isReady) return;

    const handleTracks = async () => {
      await loadTracks();
    };

    handleTracks();
  }, [isReady]);

  async function loadTracks() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      // video: true,
    });

    const audioTrack = stream.getAudioTracks()[0];
    // const videoTrack = stream.getVideoTracks()[0].clone();
    const audioProducer = await sendTransport?.produce({
      track: audioTrack,
    });
    //const videoProducer = await sendTransport.current?.produce({ track: videoTrack });
    addProducer(audioProducer);
    // addProducer(videoProducer);
    setLocalStream(stream);
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex items-center justify-between p-2 border-b border-gray-200">
        <h1 className="text-lg font-medium text-black">Meeting</h1>
      </div>

      <Participants />

      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center ${
              isMicOn
                ? "hover:bg-black hover:text-white text-black"
                : "bg-black text-white"
            }`}
          >
            <span className="text-xs font-bold">{isMicOn ? "MIC" : "MIC"}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center ${
              isVideoOn
                ? "hover:bg-black hover:text-white text-black"
                : "bg-black text-white"
            }`}
          >
            <span className="text-xs font-bold">
              {isVideoOn ? "CAM" : "CAM"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
