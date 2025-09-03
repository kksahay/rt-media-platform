import {
  PlainTransport,
  Router,
  RtpCapabilities,
  Consumer,
  ConsumerType,
  MediaKind,
  RtpParameters,
} from "mediasoup/types";
import { plainTransportOpts } from "../configs";

export interface SDPConsumer {
  id: string;
  producerId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
  type: ConsumerType;
}

export class Viewer {
  #plainTransports = new Map<string, PlainTransport>();
  #consumers = new Map<string, Consumer>();

  constructor(private readonly router: Router) {}

  async createPlainTransport() {
    const transport = await this.router.createPlainTransport(
      plainTransportOpts
    );

    this.#plainTransports.set(transport.id, transport);

    transport.on("@close", () => this.#plainTransports.delete(transport.id));
    return transport;
  }

  async connectTransport(
    transportId: string,
    ip: string,
    port: number,
    rtcpPort?: number
  ) {
    const transport = this.#plainTransports.get(transportId);
    if (!transport)
      throw new Error(`transport with id "${transportId}" does not exist`);
    await transport.connect({ ip, port, rtcpPort });
  }

  async createConsumer(
    transportId: string,
    producerId: string,
    paused: boolean,
    rtpCapabilities: RtpCapabilities
  ): Promise<SDPConsumer> {
    const transport = this.#plainTransports.get(transportId);
    if (!transport)
      throw new Error(`transport with id "${transportId}" does not exist`);

    const consumer = await transport.consume({
      producerId,
      paused,
      rtpCapabilities,
    });

    this.#consumers.set(consumer.id, consumer);
    consumer.on("transportclose", () => this.#consumers.delete(consumer.id));

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
    };
  }
}
