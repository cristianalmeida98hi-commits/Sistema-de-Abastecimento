import QRCode from 'qrcode';

/**
 * Generates a PNG Data URL (base64) for a given text or URL synchronously/asynchronously.
 */
export async function generateQRCodeDataUrl(text: string, width = 300): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code Data URL:', err);
    return '';
  }
}
