import {
  WebRtcServerOptions,
  RouterRtpCodecCapability,
  PlainTransportOptions,
  RtpCapabilities,
} from "mediasoup/types";

export const webRtcServerOption: WebRtcServerOptions = {
  listenInfos: [
    {
      protocol: "udp",
      ip: "0.0.0.0",
      port: 44444,
    },
    {
      protocol: "tcp",
      ip: "0.0.0.0",
      port: 44444,
    },
  ],
};

export const mediaCodecs: RouterRtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
    },
  },
];

export const plainTransportOpts: PlainTransportOptions = {
  listenIp: "127.0.0.1",
  rtcpMux: false,
  comedia: true,
};

export const audioCodec: RtpCapabilities = {
  codecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      preferredPayloadType: 100,
      clockRate: 48000,
      channels: 2,
      parameters: { useinbandfec: 1 },
    },
  ],
};

export const videoCodec: RtpCapabilities = {
  codecs: [
    {
      kind: "video",
      mimeType: "video/VP8",
      preferredPayloadType: 101,
      clockRate: 90000,
      parameters: {},
      rtcpFeedback: [{ type: "nack" }],
    },
  ],
};
