import { createServer, type Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { Participant } from "./lib/Participant";
import { HlsPipeline } from "./hls/HlsPipeline";
import {
  Worker,
  Router,
  AppData,
  WebRtcServer,
  Transport,
  Producer,
} from "mediasoup/types";
import { createWorker } from "mediasoup";
import {
  audioCodec,
  mediaCodecs,
  videoCodec,
  webRtcServerOption,
} from "./configs";
import { Viewer } from "./lib/Viewer";

export class App {
  #server: HttpServer;
  #io!: SocketIOServer;
  #worker!: Worker<AppData>;
  #webRtcServer!: WebRtcServer;
  #routers: Map<string, Router>;
  #hlsPipelines: Map<string, HlsPipeline>;

  constructor(private readonly PORT: string) {
    this.#server = createServer();
    this.#server.on("error", (err) => {
      console.error("Server error:", err);
    });
    this.#routers = new Map();
    this.#hlsPipelines = new Map();
  }

  async initSignal() {
    this.#io = new SocketIOServer(this.#server, {
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
      cors: {
        origin: "*",
      },
    });

    this.#io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on("joinRoom", async ({ roomId, viewMode }) => {
        let router = this.#routers.get(roomId);
        if (viewMode && !router) {
          return;
        }
        if (!router) {
          router = await this.#initRouter();
          this.#routers.set(roomId, router);
        }

        const participants = await this.#io.in(roomId).fetchSockets();

        if (viewMode) {
          const viewer = new Viewer(router);
          const audioTransport = await viewer.createPlainTransport();
          const videoTransport = await viewer.createPlainTransport();
          console.log("AUDIO transport ports", {
            rtpPort: audioTransport.port,
            rtcpPort: audioTransport.rtcpPort,
          });
          console.log("AUDIO transport ports", {
            rtpPort: videoTransport.port,
            rtcpPort: videoTransport.rtcpPort,
          });
          await viewer.connectTransport(
            audioTransport.id,
            "127.0.0.1",
            audioTransport.port,
            audioTransport.rtcpPort
          );
          await viewer.connectTransport(
            videoTransport.id,
            "127.0.0.1",
            videoTransport.port,
            videoTransport.rtcpPort
          );

          for (const participant of participants) {
            for (const producer of participant.data.producers.values() as Producer[]) {
              if (producer.kind === "audio") {
                await viewer.createConsumer(
                  audioTransport.id,
                  producer.id,
                  true,
                  audioCodec
                );
              } else {
                await viewer.createConsumer(
                  videoTransport.id,
                  producer.id,
                  true,
                  videoCodec
                );
              }
            }
          }

          if (!this.#hlsPipelines.has(roomId)) {
            const pipeline = new HlsPipeline(
              "127.0.0.1",
              {
                rtpPort: audioTransport.port,
                rtcpPort: audioTransport.rtcpPort,
              },
              {
                rtpPort: videoTransport.port,
                rtcpPort: videoTransport.rtcpPort,
              }
            );

            pipeline.start();

            this.#hlsPipelines.set(roomId, pipeline);

            console.log(`Started HLS pipeline for room ${roomId}`);
          }
        } else {
          socket.data.router = router;
          socket.data.roomId = roomId;
          socket.data.webRtcServer = this.#webRtcServer;

          socket.join(roomId);

          const participant = new Participant(socket, participants);

          participant.joinRoom();
          socket.on("disconnect", () => {
            if (participants.length == 1) {
              console.log("Closing the room", roomId);
              router.close();
              this.#routers.delete(roomId);
            }

            const pipelineEntry = this.#hlsPipelines.get(roomId);
            if (pipelineEntry) {
              pipelineEntry.stop();
              this.#hlsPipelines.delete(roomId);
              console.log(`Stopped HLS pipeline for room ${roomId}`);
            }
          });
        }
      });
    });
  }

  async initWorker() {
    this.#worker = await createWorker({
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: "warn",
    });

    this.#worker.on("died", () => {
      process.exit(1);
    });

    this.#webRtcServer = await this.#worker.createWebRtcServer(
      webRtcServerOption
    );

    console.log("Worker and WebRtc Server initialized");
  }

  async #initRouter() {
    const router = await this.#worker.createRouter({ mediaCodecs });
    return router;
  }

  public listen(): Promise<void> {
    return new Promise((resolve) => {
      this.#server.listen(this.PORT, () => {
        console.log(`Server is running on Port: ${this.PORT}`);
        resolve();
      });
    });
  }
}
