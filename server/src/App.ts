import {
  createServer,
  IncomingMessage,
  ServerResponse,
  type Server as HttpServer,
} from "node:http";
import { parse } from "url";
import { Server as SocketIOServer } from "socket.io";
import { Participant } from "./lib/Participant";
import { HlsPipeline } from "./hls/HlsPipeline";
import {
  Worker,
  Router,
  AppData,
  WebRtcServer, Producer
} from "mediasoup/types";
import { createWorker } from "mediasoup";
import {
  audioCodec,
  mediaCodecs,
  videoCodec,
  webRtcServerOption,
} from "./configs";
import { Viewer } from "./lib/Viewer";
import { buildSdp, getPort } from "./utils";

export class App {
  #server: HttpServer;
  #io!: SocketIOServer;
  #worker!: Worker<AppData>;
  #webRtcServer!: WebRtcServer;
  #routers: Map<string, Router>;
  #hlsPipelines: Map<string, HlsPipeline>;

  constructor(private readonly PORT: string) {
    this.routeHandler = this.routeHandler.bind(this);
    this.#server = createServer(this.routeHandler);
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

      socket.on("joinRoom", async ({ roomId }) => {
        let router = this.#routers.get(roomId);

        if (!router) {
          router = await this.#initRouter();
          this.#routers.set(roomId, router);
        }

        const participants = await this.#io.in(roomId).fetchSockets();
        socket.data.router = router;
        socket.data.roomId = roomId;
        socket.data.webRtcServer = this.#webRtcServer;

        socket.join(roomId);

        const participant = new Participant(socket, participants);

        participant.joinRoom();
        socket.on("disconnect", () => {
          if (participants.length == 0) {
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

  async routeHandler(req: IncomingMessage, res: ServerResponse) {
    const { pathname, query } = parse(req.url!, true);

    if (pathname === "/watch") {
      const roomId = query.room as string;

      if (!roomId) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Missing roomId");
      }

      let router = this.#routers.get(roomId);
      if (!router) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("Room not found");
      }
      const viewer = new Viewer(router);
      const audioTransport = await viewer.createPlainTransport();
      const videoTransport = await viewer.createPlainTransport();

      const ffmpegAudioPort = await getPort();
      const ffmpegVideoPort = await getPort();

      await viewer.connectTransport(
        audioTransport.id,
        "127.0.0.1",
        ffmpegAudioPort,
        ffmpegAudioPort + 1
      );
      await viewer.connectTransport(
        videoTransport.id,
        "127.0.0.1",
        ffmpegVideoPort,
        ffmpegVideoPort + 1
      );

      const participants = await this.#io.in(roomId).fetchSockets();

      for (const participant of participants) {
        let audioConsumer, videoConsumer;
        for (const producer of participant.data.producers.values() as Producer[]) {
          if (producer.kind === "audio") {
            audioConsumer = await viewer.createConsumer(
              audioTransport.id,
              producer.id,
              true,
              audioCodec
            );
          } else {
            videoConsumer = await viewer.createConsumer(
              videoTransport.id,
              producer.id,
              true,
              videoCodec
            );
          }
        }
        buildSdp({
          ip: "127.0.0.1",
          participantId: participant.id,
          audioConsumer,
          videoConsumer,
          remoteAudioPort: ffmpegAudioPort,
          remoteVideoPort: ffmpegVideoPort,
        });
      }

      // const pipeline =

      res.writeHead(200, { "Content-Type": "application/json" });
      console.log(audioTransport.tuple.remotePort);
      res.end(
        JSON.stringify({
          audioTransport: {
            id: audioTransport.id,
            ip: audioTransport.tuple.localIp,
            port: audioTransport.tuple.localPort,
            rtcpPort: audioTransport.tuple.remotePort,
          },
          videoTransport: {
            id: videoTransport.id,
            ip: videoTransport.tuple.localIp,
            port: videoTransport.tuple.localPort,
            rtcpPort: videoTransport.tuple.remotePort,
          },
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
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
