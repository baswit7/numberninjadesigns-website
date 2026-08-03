import test from "node:test";
import assert from "node:assert/strict";
import { validateProbeData } from "../lib/index.mjs";

function probe({
  width = 1080,
  height = 1920,
  duration = "15.000000",
  frameRate = "30/1",
  audio = true,
  audioCodec = "aac"
} = {}) {
  return {
    streams: [
      {
        codec_type: "video",
        codec_name: "h264",
        pix_fmt: "yuv420p",
        width,
        height,
        avg_frame_rate: frameRate
      },
      ...(audio ? [{ codec_type: "audio", codec_name: audioCodec }] : [])
    ],
    format: { duration }
  };
}

test("social master profile accepts only the exact production envelope", () => {
  assert.equal(validateProbeData(probe(), "SOCIAL_MASTER").valid, true);

  const invalid = validateProbeData(
    probe({ width: 1920, height: 1080, duration: "15.200000", frameRate: "30000/1001" }),
    "SOCIAL_MASTER"
  );
  assert.equal(invalid.valid, false);
  assert.deepEqual(
    invalid.issues.map((issue) => issue.code).sort(),
    ["FRAME_RATE_INVALID", "VIDEO_DIMENSIONS_INVALID", "VIDEO_TOO_LONG"]
  );
});

test("Etsy master is exact 2:1 and silent", () => {
  const valid = validateProbeData(
    probe({ width: 1920, height: 960, duration: "12", audio: false }),
    "ETSY_SILENT"
  );
  assert.equal(valid.valid, true);

  const withAudio = validateProbeData(
    probe({ width: 1920, height: 960, duration: "12", audio: true }),
    "ETSY_SILENT"
  );
  assert.equal(withAudio.valid, false);
  assert.equal(withAudio.issues[0].code, "AUDIO_FORBIDDEN");
});

test("instruction video requires 1080p H.264/yuv420p/30fps with AAC", () => {
  const valid = validateProbeData(
    probe({ width: 1920, height: 1080, duration: "100", audio: true }),
    "INSTRUCTION_VIDEO"
  );
  assert.equal(valid.valid, true);

  const invalid = validateProbeData(
    probe({ width: 1920, height: 1080, duration: "100", audio: false }),
    "INSTRUCTION_VIDEO"
  );
  assert.equal(invalid.valid, false);
  assert.equal(invalid.issues[0].code, "AAC_AUDIO_REQUIRED");
});
