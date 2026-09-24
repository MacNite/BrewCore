import { describe, expect, it } from "vitest";
import { qrCodePngDataUrl } from "./qr-code";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("qrCodePngDataUrl", () => {
  it("renders an invitation link as a 512 px PNG data URL", async () => {
    const url = await qrCodePngDataUrl(`https://brew.example.test/invite/${"a".repeat(43)}`);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);

    const png = Buffer.from(url.slice("data:image/png;base64,".length), "base64");
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    // IHDR width and height, big-endian, right after the signature and chunk header.
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  });

  it("is deterministic, so the same link always gives the same code", async () => {
    const link = "https://brew.example.test/invite/token";
    expect(await qrCodePngDataUrl(link)).toBe(await qrCodePngDataUrl(link));
    expect(await qrCodePngDataUrl(link)).not.toBe(await qrCodePngDataUrl(`${link}2`));
  });
});
