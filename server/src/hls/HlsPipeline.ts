import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";

export class HlsPipeline {
  private ffmpeg?: ChildProcessWithoutNullStreams;
  private sdpPath: string;

  constructor(
    private readonly ip: string,
    private readonly remoteAudioPort?: number,
    private readonly remoteVideoPort?: number,
    private readonly outDir: string = path.join(process.cwd(), "public/hls")
  ) {
    this.sdpPath = path.join(this.outDir, "input.sdp");
  }

  

  async start() {
    if (this.ffmpeg) return;


    const args = [
      "-protocol_whitelist",
      "file,udp,rtp",
      "-i",
      this.sdpPath,
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

    /* this.ffmpeg = spawn("ffmpeg", args);
    this.ffmpeg.stderr.on("data", (d) =>
      console.error("FFmpeg:", d.toString())
    );
    this.ffmpeg.on("exit", (code) =>
      console.log(`FFmpeg exited with code ${code}`)
    ); */
  }

  stop() {
    if (this.ffmpeg) {
      this.ffmpeg.kill("SIGINT");
      this.ffmpeg = undefined;
    }
  }
}
