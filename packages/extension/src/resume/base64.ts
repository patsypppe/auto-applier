// Turns bytes into text and back, because a runtime message cannot carry raw binary data.
const CHUNK_SIZE = 0x8000

// Encodes bytes as base64 text, in chunks so a large file does not overflow the call stack.
export function bytesToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let binary = ""
  for (let start = 0; start < bytes.length; start += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK_SIZE))
  }
  return btoa(binary)
}

// Decodes base64 text back into bytes.
export function base64ToBytes(text: string): ArrayBuffer {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer as ArrayBuffer
}
