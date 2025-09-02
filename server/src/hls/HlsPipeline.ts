import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";

export class HlsPipeline {
  private ffmpeg?: ChildProcessWithoutNullStreams;

  constructor(
    private readonly ip: string,
    private readonly audioTransport: { rtpPort: number; rtcpPort?: number },
    private readonly videoTransport: { rtpPort: number; rtcpPort?: number },
    private readonly outDir: string = path.join(process.cwd(), "public/hls")
  ) {}

  private writeSDPFile(): string {
    const sdp = `
v=0
o=- 0 0 IN IP4 ${this.ip}
s=Mediasoup HLS
c=IN IP4 ${this.ip}
t=0 0

m=audio ${this.audioTransport.rtpPort} RTP/AVP 111
a=rtcp:${this.audioTransport.rtcpPort}
a=rtpmap:111 opus/48000/2

m=video ${this.videoTransport.rtpPort} RTP/AVP 96
a=rtcp:${this.videoTransport.rtcpPort}
a=rtpmap:96 H264/90000
a=fmtp:96 packetization-mode=1
    `.trim();

    const filePath = path.join(this.outDir, "input.sdp");
    fs.mkdirSync(this.outDir, { recursive: true });
    fs.writeFileSync(filePath, sdp);
    return filePath;
  }

  start() {
    if (this.ffmpeg) return;

    const sdpPath = this.writeSDPFile();

    const args = [
      "-protocol_whitelist",
      "file,udp,rtp",
      "-f",
      "sdp",
      "-i",
      sdpPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-g",
      "48",
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-b:a",
      "128k",
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_list_size",
      "5",
      "-hls_flags",
      "delete_segments",
      path.join(this.outDir, "stream.m3u8"),
    ];

    this.ffmpeg = spawn("ffmpeg", args);

    this.ffmpeg.stderr.on("data", (d) =>
      console.error("FFmpeg:", d.toString())
    );
    this.ffmpeg.on("exit", (code) =>
      console.log(`FFmpeg exited with code ${code}`)
    );

    console.log("Started HLS pipeline, writing to", this.outDir);
  }

  stop() {
    if (this.ffmpeg) {
      this.ffmpeg.kill("SIGINT");
      this.ffmpeg = undefined;
    }
  }
}
