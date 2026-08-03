import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { promisify } from "node:util";
import { FlowError, assert } from "./core.mjs";

const execFileAsync = promisify(execFile);

export const VIDEO_PROFILES = Object.freeze({
  SOCIAL_MASTER: {
    width: 1080,
    height: 1920,
    minDuration: 14.9,
    maxDuration: 15.1,
    frameRate: 30,
    codec: "h264",
    pixelFormat: "yuv420p",
    audio: "OPTIONAL_AAC"
  },
  ETSY_SILENT: {
    width: 1920,
    height: 960,
    minDuration: 3,
    maxDuration: 15,
    frameRate: 30,
    codec: "h264",
    pixelFormat: "yuv420p",
    audio: "FORBIDDEN"
  },
  INSTRUCTION_VIDEO: {
    width: 1920,
    height: 1080,
    minDuration: 10,
    maxDuration: null,
    frameRate: 30,
    codec: "h264",
    pixelFormat: "yuv420p",
    audio: "REQUIRED_AAC"
  }
});

function parseRate(value) {
  if (typeof value === "number") {
    return value;
  }
  const [numerator, denominator = "1"] = String(value ?? "").split("/").map(Number);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : Number.NaN;
}

function issue(code, message, actual, expected) {
  return { severity: "BLOCKING", code, message, actual, expected };
}

export function validateProbeData(probe, profileName) {
  const profile = VIDEO_PROFILES[profileName];
  assert(profile, "VIDEO_PROFILE_UNKNOWN", `Unknown video profile: ${profileName}.`);
  assert(probe && typeof probe === "object", "PROBE_DATA_INVALID", "FFprobe JSON is required.");

  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format?.duration ?? video?.duration);
  const frameRate = parseRate(video?.avg_frame_rate ?? video?.r_frame_rate);
  const issues = [];

  if (!video) {
    issues.push(issue("VIDEO_STREAM_MISSING", "A video stream is required.", null, "video"));
  } else {
    if (video.codec_name !== profile.codec) {
      issues.push(issue("VIDEO_CODEC_INVALID", "Video codec does not match the profile.", video.codec_name, profile.codec));
    }
    if (video.pix_fmt !== profile.pixelFormat) {
      issues.push(issue("PIXEL_FORMAT_INVALID", "Pixel format does not match the profile.", video.pix_fmt, profile.pixelFormat));
    }
    if (Number(video.width) !== profile.width || Number(video.height) !== profile.height) {
      issues.push(
        issue(
          "VIDEO_DIMENSIONS_INVALID",
          "Video dimensions do not match the profile.",
          `${video.width}x${video.height}`,
          `${profile.width}x${profile.height}`
        )
      );
    }
    if (!Number.isFinite(frameRate) || Math.abs(frameRate - profile.frameRate) > 0.001) {
      issues.push(issue("FRAME_RATE_INVALID", "Frame rate must be exactly 30 fps.", frameRate, profile.frameRate));
    }
  }

  if (!Number.isFinite(duration) || duration < profile.minDuration) {
    issues.push(issue("VIDEO_TOO_SHORT", "Video duration is below the profile minimum.", duration, profile.minDuration));
  }
  if (profile.maxDuration !== null && duration > profile.maxDuration) {
    issues.push(issue("VIDEO_TOO_LONG", "Video duration exceeds the profile maximum.", duration, profile.maxDuration));
  }

  if (profile.audio === "FORBIDDEN" && audio) {
    issues.push(issue("AUDIO_FORBIDDEN", "This video profile must be silent.", audio.codec_name, null));
  }
  if (profile.audio === "REQUIRED_AAC" && audio?.codec_name !== "aac") {
    issues.push(issue("AAC_AUDIO_REQUIRED", "An AAC audio stream is required.", audio?.codec_name ?? null, "aac"));
  }
  if (profile.audio === "OPTIONAL_AAC" && audio && audio.codec_name !== "aac") {
    issues.push(issue("AUDIO_CODEC_INVALID", "Optional audio must use AAC.", audio.codec_name, "aac"));
  }

  return {
    profile: profileName,
    valid: issues.length === 0,
    facts: {
      codec: video?.codec_name ?? null,
      pixelFormat: video?.pix_fmt ?? null,
      width: Number(video?.width) || null,
      height: Number(video?.height) || null,
      frameRate: Number.isFinite(frameRate) ? frameRate : null,
      duration: Number.isFinite(duration) ? duration : null,
      audioCodec: audio?.codec_name ?? null
    },
    issues
  };
}

export async function probeVideo(filePath, options = {}) {
  const absoluteFile = resolve(filePath);
  assert(extname(absoluteFile).toLowerCase() === ".mp4", "VIDEO_CONTAINER_INVALID", "Video must be an MP4 file.");
  await access(absoluteFile);

  const ffprobePath = options.ffprobePath ?? process.env.NND_FFPROBE;
  if (!ffprobePath) {
    throw new FlowError(
      "FFPROBE_NOT_CONFIGURED",
      "Set NND_FFPROBE to a trusted ffprobe executable before technical validation."
    );
  }

  const { stdout } = await execFileAsync(
    resolve(ffprobePath),
    [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      absoluteFile
    ],
    {
      windowsHide: true,
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: 5 * 1024 * 1024
    }
  );

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new FlowError("FFPROBE_OUTPUT_INVALID", "FFprobe did not return valid JSON.", {
      cause: error.message
    });
  }
}

export async function validateVideoFile(filePath, profileName, options = {}) {
  return validateProbeData(await probeVideo(filePath, options), profileName);
}
