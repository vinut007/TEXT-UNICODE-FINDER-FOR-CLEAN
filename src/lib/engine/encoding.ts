export interface DecodedText {
  text: string;
  encoding: string;
  confidence: 'bom' | 'strict' | 'fallback';
  hasBom: boolean;
  warnings: string[];
}

/**
 * Decode raw bytes with BOM sniffing + strict UTF-8 validation.
 * Falls back to Windows-1252 when the bytes are not valid UTF-8.
 */
export function decodeText(buffer: ArrayBuffer): DecodedText {
  const bytes = new Uint8Array(buffer);
  const warnings: string[] = [];

  // ---- UTF-16 / UTF-8 BOM ----
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = new TextDecoder('utf-8').decode(bytes.subarray(3));
    return { text, encoding: 'UTF-8 with BOM', confidence: 'bom', hasBom: true, warnings };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
    return { text, encoding: 'UTF-16 LE with BOM', confidence: 'bom', hasBom: true, warnings };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
    return { text, encoding: 'UTF-16 BE with BOM', confidence: 'bom', hasBom: true, warnings };
  }

  // ---- strict UTF-8 check ----
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'UTF-8', confidence: 'strict', hasBom: false, warnings };
  } catch {
    // fall through
  }

  // ---- Windows-1252 fallback ----
  try {
    const text = new TextDecoder('windows-1252').decode(bytes);
    warnings.push(
      'File is not valid UTF-8. It was decoded as Windows-1252 (best effort) so suspicious sequences may include legitimate high-bit text.',
    );
    return { text, encoding: 'Windows-1252 (fallback)', confidence: 'fallback', hasBom: false, warnings };
  } catch {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    warnings.push('File could not be decoded reliably; invalid byte sequences were replaced with U+FFFD.');
    return { text, encoding: 'UTF-8 (lossy)', confidence: 'fallback', hasBom: false, warnings };
  }
}

/** Strip a UTF-8 BOM that survived as a character (defensive). */
export function stripLeadingBom(text: string): { text: string; hadBom: boolean } {
  if (text.charCodeAt(0) === 0xfeff) return { text: text.slice(1), hadBom: true };
  return { text, hadBom: false };
}
