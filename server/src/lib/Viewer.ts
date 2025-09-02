import {
	PlainTransport, Router,
	RtpCapabilities
} from "mediasoup/types";
import { plainTransportOpts } from "../configs";



export class Viewer {
  #plainTransports: Map<string, PlainTransport>;

  constructor(
    private readonly router: Router,
  ) {
    this.#plainTransports = new Map();
  }

  async createPlainTransport() {
    const transport = await this.router.createPlainTransport(
      plainTransportOpts
    );
    this.#plainTransports.set(transport.id, transport);

    return {
      id: transport.id,
      ip: transport.tuple.localIp,
      port: transport.tuple.localPort,
      rtcpPort: transport.rtcpTuple?.localPort,
    };
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
  ) {
    const transport = this.#plainTransports.get(transportId);
    if (!transport)
      throw new Error(`transport with id "${transportId}" does not exist`);
    const consumer = await transport.consume({
      producerId,
      paused,
      rtpCapabilities,
    });
    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
    };
  }
}
