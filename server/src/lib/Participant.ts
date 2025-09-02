import {
  Router,
  WebRtcTransport,
  WebRtcServer,
  Producer,
  Consumer,
} from "mediasoup/types";
import { RemoteSocket, Socket } from "socket.io";
import {
  DecorateAcknowledgementsWithMultipleResponses,
  DefaultEventsMap,
} from "socket.io/dist/typed-events";

export class Participant {
  #webRtcTransports: Map<string, WebRtcTransport>;
  #producers: Map<string, Producer>;
  #consumers: Map<string, Consumer>;
  router: Router;
  webRtcServer: WebRtcServer;

  constructor(
    private readonly socket: Socket,
    private readonly participants: RemoteSocket<
      DecorateAcknowledgementsWithMultipleResponses<DefaultEventsMap>,
      any
    >[]
  ) {
    this.#webRtcTransports = new Map();
    this.#producers = new Map();
    this.#consumers = new Map();

    this.router = this.socket.data.router;
    this.webRtcServer = this.socket.data.webRtcServer;

    this.socket.data.webRtcTransports = this.#webRtcTransports;
    this.socket.data.producers = this.#producers;
    this.socket.data.consumers = this.#consumers;
  }

  async #createWebRtcTransport({
    producing,
    consuming,
  }: {
    producing: boolean;
    consuming: boolean;
  }) {
    if (!this.webRtcServer) throw new Error("WebRtcServer not initialized");

    const transport = await this.router.createWebRtcTransport({
      webRtcServer: this.webRtcServer,
      enableSctp: true,
      numSctpStreams: { OS: 1024, MIS: 1024 },
      appData: { producing, consuming },
    });

    this.#webRtcTransports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  async #createConsumer(
    consumerParticipant:
      | Socket
      | RemoteSocket<
          DecorateAcknowledgementsWithMultipleResponses<DefaultEventsMap>,
          any
        >,
    producer: Producer
  ) {
    const router = this.router;
    const rtpCapabilities = consumerParticipant.data.rtpCapabilities;

    if (
      !rtpCapabilities ||
      !router.canConsume({ producerId: producer.id, rtpCapabilities })
    ) {
      return;
    }

    const transport = Array.from(this.#webRtcTransports.values()).find(
      (t) => t.appData.consuming
    );

    if (!transport) return;

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true,
    });

    consumerParticipant.data.consumers.set(consumer.id, consumer);

    await consumer.resume();

    return {
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  #cleanup() {
    for (const consumer of this.#consumers.values()) {
      consumer.close();
    }
    this.#consumers.clear();

    for (const producer of this.#producers.values()) {
      producer.close();
    }
    this.#producers.clear();

    for (const transport of this.#webRtcTransports.values()) {
      transport.close();
    }
    this.#webRtcTransports.clear();
  }

  joinRoom() {
    this.socket.emit("getRouterRtpCapabilities", {
      routerRtpCapabilities: this.router.rtpCapabilities,
    });

    this.socket.on(
      "join",
      async ({ rtpCapabilities, sctpCapabilities }, callback) => {
        if (this.socket.data.joined) {
          return callback({ success: false, error: "Already joined" });
        }

        this.socket.data.joined = true;
        this.socket.data.rtpCapabilities = rtpCapabilities;
        this.socket.data.sctpCapabilities = sctpCapabilities;

        for (const participant of this.participants) {
          for (const producer of participant.data.producers.values() as Producer[]) {
            const consumerResult = await this.#createConsumer(
              this.socket,
              producer
            );
            if (consumerResult) {
              this.socket.emit("newConsumer", {
                participantId: participant.id,
                producerId: producer.id,
                ...consumerResult,
              });
            }
          }
        }

        callback({ success: true });
      }
    );

    this.socket.on(
      "createWebRtcTransport",
      async ({ producing, consuming }, callback) => {
        try {
          const transport = await this.#createWebRtcTransport({
            producing,
            consuming,
          });
          callback({ success: true, transport });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    this.socket.on(
      "connectWebRtcTransport",
      async ({ transportId, dtlsParameters }, callback) => {
        const transport = this.#webRtcTransports.get(transportId);
        if (!transport) {
          return callback({
            success: false,
            error: `transport ${transportId} not found`,
          });
        }
        try {
          await transport.connect({ dtlsParameters });
          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    this.socket.on(
      "produce",
      async ({ transportId, kind, rtpParameters }, callback) => {
        const transport = this.#webRtcTransports.get(transportId);
        if (!transport) {
          return callback({
            success: false,
            error: `transport ${transportId} not found`,
          });
        }

        try {
          const producer = await transport.produce({ kind, rtpParameters });
          this.#producers.set(producer.id, producer);

          const otherParticipants = this.participants.filter(
            (p) => p.id !== this.socket.id
          );
          for (const other of otherParticipants) {
            const consumerResult = await this.#createConsumer(other, producer);
            if (consumerResult) {
              this.socket.to(other.id).emit("newConsumer", {
                participantId: this.socket.id,
                producerId: producer.id,
                ...consumerResult,
              });
            }
          }

          callback({ success: true, producerId: producer.id });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    this.socket.on("disconnect", () => {
      this.#cleanup();

      this.socket.to(this.socket.data.roomId).emit("participantDisconnected", {
        participantId: this.socket.id,
      });

      console.log(`Cleaned up and disconnected: ${this.socket.id}`);
    });
  }
}
