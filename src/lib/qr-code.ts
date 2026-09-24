import QRCode from "qrcode";

/**
 * QR code for an invitation link (§47), rendered on the server so the link
 * never leaves the instance for a third-party QR service.
 *
 * Always dark on white with the standard four-module quiet zone, whatever the
 * UI theme: phone cameras read inverted or low-contrast codes unreliably.
 * Error correction `M` keeps the code scannable from a slightly blurry photo
 * or a phone screen without making it dense.
 */
export function qrCodePngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
