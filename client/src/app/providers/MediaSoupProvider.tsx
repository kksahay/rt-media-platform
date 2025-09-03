"use client";

import { Device } from "mediasoup-client";
import { RtpCapabilities, Transport } from "mediasoup-client/types";
import {
  createContext,
  ReactNode,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import { SocketContext } from "./SocketProvider";
import { useParticipantStore } from "../stores/participant";

interface MediaSoupContextType {
  sendTransport: Transport | null;
  recvTransport: Transport | null;
  isReady: boolean;
}

function randomRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

export const MediaSoupContext = createContext<MediaSoupContextType>({
  sendTransport: null,
  recvTransport: null,
  isReady: false,
});

export default function MediaSoupProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [sendTransport, setSendTransport] = useState<Transport | null>(null);
  const [recvTransport, setRecvTransport] = useState<Transport | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { socket, isConnected } = use(SocketContext);
  const roomId = useRef<string | null>(null);
  const deviceRef = useRef<Device | null>(null);

  const addParticipant = useParticipantStore((state) => state.addParticipant);
  const removeParticipant = useParticipantStore(
    (state) => state.removeParticipant
  );

  useEffect(() => {
    if (window.location.pathname !== "/stream") return;
    if (!socket || !isConnected) return;

    const device = new Device();
    deviceRef.current = device;

    const params = new URLSearchParams(window.location.search);
    let id = params.get("room");

    if (!id) {
      id = randomRoomId();
      params.set("room", id);
      window.history.replaceState({}, "", `?${params.toString()}`);
    }

    roomId.current = id;

    socket.emit("joinRoom", { roomId: roomId.current });

    const handleRouterCaps = async ({
      routerRtpCapabilities,
    }: {
      routerRtpCapabilities: RtpCapabilities;
    }) => {
      await device.load({ routerRtpCapabilities });
      console.log("router capabilities loaded");

      // Producer transport
      socket.emit(
        "createWebRtcTransport",
        { producing: true, consuming: false },
        (res: any) => {
          if (!res.success) {
            console.error("Producer transport creation failed:", res.error);
            return;
          }
          const producerTransport = device.createSendTransport(res.transport);
          setSendTransport(producerTransport);

          producerTransport.on(
            "connect",
            ({ dtlsParameters }, callback, errback) => {
              socket.emit(
                "connectWebRtcTransport",
                { transportId: producerTransport.id, dtlsParameters },
                (res: any) => {
                  if (!res.success) {
                    return errback(new Error(res.error));
                  }
                  console.log("send transport connected");
                  callback();
                }
              );
            }
          );

          producerTransport.on(
            "produce",
            ({ kind, rtpParameters }, callback, errback) => {
              socket.emit(
                "produce",
                {
                  transportId: producerTransport.id,
                  kind,
                  rtpParameters,
                },
                (res: any) => {
                  if (!res.success) {
                    return errback(new Error(res.error));
                  }

                  callback({ id: res.producerId });
                }
              );
            }
          );
        }
      );

      // Consumer transport
      socket.emit(
        "createWebRtcTransport",
        { producing: false, consuming: true },
        (res: any) => {
          if (!res.success) {
            console.error("Consumer transport creation failed:", res.error);
            return;
          }

          const consumerTransport = device.createRecvTransport(res.transport);
          setRecvTransport(consumerTransport);

          socket.emit(
            "join",
            {
              rtpCapabilities: deviceRef.current?.rtpCapabilities,
              sctpCapabilities: deviceRef.current?.sctpCapabilities,
            },
            (res: any) => {
              console.log(res);
            }
          );

          consumerTransport.on(
            "connect",
            ({ dtlsParameters }, callback, errback) => {
              socket.emit(
                "connectWebRtcTransport",
                { transportId: consumerTransport.id, dtlsParameters },
                (res: any) => {
                  if (!res.success) {
                    return errback(new Error(res.error));
                  }
                  console.log("receive transport connected");
                  callback();
                }
              );
            }
          );

          socket.on(
            "newConsumer",
            async ({ participantId, id, producerId, kind, rtpParameters }) => {
              const consumer = await consumerTransport.consume({
                id,
                producerId,
                kind,
                rtpParameters,
              });
              addParticipant(participantId, consumer);
            }
          );
        }
      );
    };

    const handleDisconnection = ({
      participantId,
    }: {
      participantId: string;
    }) => {
      removeParticipant(participantId);
      console.log(participantId, "removed");
    };

    socket.on("getRouterRtpCapabilities", handleRouterCaps);
    socket.on("participantDisconnected", handleDisconnection);

    return () => {
      socket.off("getRouterRtpCapabilities", handleRouterCaps);
      socket.off("participantDisconnected", handleDisconnection);

      sendTransport?.close();
      recvTransport?.close();
      setSendTransport(null);
      setRecvTransport(null);
    };
  }, [isConnected]);

  useEffect(() => {
    if (sendTransport && recvTransport) {
      setIsReady(true);
    }
  }, [sendTransport, recvTransport]);

  return (
    <MediaSoupContext.Provider
      value={{ sendTransport, recvTransport, isReady }}
    >
      {children}
    </MediaSoupContext.Provider>
  );
}
