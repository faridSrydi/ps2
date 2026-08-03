// ============================================================
// PS2 Cloud Gaming Platform — QR Code Generator
// Generates QR codes for controller pairing
// ============================================================

import QRCode from 'qrcode';

/**
 * Generate a QR code as a data URL (base64 PNG) for the controller page.
 * When scanned, it opens the controller page with the room ID.
 *
 * @param {string} roomId - Room ID (e.g., "ABCD-1234")
 * @param {string} baseUrl - Base URL of the server
 * @returns {Promise<string>} Base64 data URL of QR code image
 */
export async function generateQRCode(roomId, baseUrl = '') {
  const controllerUrl = `${baseUrl}/controller?room=${roomId}`;

  const dataUrl = await QRCode.toDataURL(controllerUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#FFFFFF',   // White on dark theme
      light: '#00000000', // Transparent background
    },
    errorCorrectionLevel: 'M',
  });

  return {
    dataUrl,
    controllerUrl,
  };
}

/**
 * Generate QR code as SVG string
 * @param {string} roomId - Room ID
 * @param {string} baseUrl - Base URL
 * @returns {Promise<string>} SVG string
 */
export async function generateQRCodeSVG(roomId, baseUrl = '') {
  const controllerUrl = `${baseUrl}/controller?room=${roomId}`;

  const svg = await QRCode.toString(controllerUrl, {
    type: 'svg',
    width: 300,
    margin: 2,
    color: {
      dark: '#FFFFFF',
      light: '#00000000',
    },
  });

  return { svg, controllerUrl };
}

export default { generateQRCode, generateQRCodeSVG };
