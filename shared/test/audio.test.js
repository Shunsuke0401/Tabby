import { describe, it, expect } from "vitest";
import { downsampleToPCM16, pcm16ToFloat32, pcm16ToBase64 } from "../../extension/src/audio.js";

describe("audio conversion", () => {
  it("encodes full-scale float to int16 and halves the length on 2:1 downsample", () => {
    const input = new Float32Array([1, 1, -1, -1]); // 4 samples @ 32kHz
    const out = downsampleToPCM16(input, 32000, 16000);
    expect(out.length).toBe(2);
    expect(out[0]).toBe(32767);
    expect(out[1]).toBe(-32768);
  });

  it("round-trips pcm16 -> float32 near unity", () => {
    const f = pcm16ToFloat32(new Int16Array([32767, -32768, 0]));
    expect(f[0]).toBeCloseTo(1, 2);
    expect(f[1]).toBeCloseTo(-1, 2);
    expect(f[2]).toBe(0);
  });

  it("encodes pcm16 to base64 little-endian bytes (for sendRealtimeInput)", () => {
    // 256 = 0x0100 -> LE bytes [0x00, 0x01] -> base64 "AAE="
    expect(pcm16ToBase64(new Int16Array([256]))).toBe("AAE=");
  });
});
