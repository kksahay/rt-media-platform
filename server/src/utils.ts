import fs from "fs";
import path from "path";
import { SDPConsumer } from "./lib/Viewer";

const outDir = path.join(process.cwd(), "public/hls/participants");

interface BuildSdpOptions {
  ip: string;
  participantId: string;
  audioConsumer?: SDPConsumer;
  videoConsumer?: SDPConsumer;
  remoteAudioPort?: number;
  remoteVideoPort?: number;
}

export const buildSdp = (options: BuildSdpOptions) => {
  const {
    ip,
    participantId,
    audioConsumer,
    videoConsumer,
    remoteAudioPort,
    remoteVideoPort,
  } = options;

  const audioCodec = audioConsumer?.rtpParameters.codecs[0];
  const videoCodec = videoConsumer?.rtpParameters.codecs[0];

  const lines: string[] = [
    "v=0",
    `o=- 0 0 IN IP4 ${ip}`,
    "s=FFmpeg",
    `c=IN IP4 ${ip}`,
    "t=0 0",
  ];

  if (audioConsumer && remoteAudioPort) {
    lines.push(
      `m=audio ${remoteAudioPort} RTP/AVP ${audioCodec?.payloadType}`,
      `a=rtpmap:${audioCodec?.payloadType} ${audioCodec?.mimeType.replace(
        "audio/",
        ""
      )}/${audioCodec?.clockRate}/${audioCodec?.channels}`,
      "a=recvonly"
    );
  }

  if (videoConsumer && remoteVideoPort) {
    lines.push(
      `m=video ${remoteVideoPort} RTP/AVP ${videoCodec?.payloadType}`,
      `a=rtpmap:${videoCodec?.payloadType} ${videoCodec?.mimeType.replace(
        "video/",
        ""
      )}/${videoCodec?.clockRate}`,
      "a=recvonly"
    );
  }

  fs.mkdirSync(outDir, { recursive: true });

  const sdpPath = path.join(outDir, `participant_${participantId}.sdp`);
  fs.writeFileSync(sdpPath, lines.join("\n"));
};

const MIN_PORT = 20000;
const MAX_PORT = 30000;

const takenPortSet = new Set();

export const getPort = async () => {
  let port = getRandomPort();

  while (takenPortSet.has(port)) {
    port = getRandomPort();
  }

  takenPortSet.add(port);

  return port;
};

const getRandomPort = () =>
  Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT);
