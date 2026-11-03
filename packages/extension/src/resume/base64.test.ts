// Tests that bytes survive the trip to text and back, which a runtime message needs because it cannot carry raw binary data.
import { describe, expect, test } from "vitest"
import { base64ToBytes, bytesToBase64 } from "./base64"

// Builds a buffer holding the given byte values.
function bufferOf(values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer
}

describe("base64", () => {
  test("encodes known bytes the standard way", () => {
    expect(bytesToBase64(new TextEncoder().encode("%PDF").buffer as ArrayBuffer)).toBe("JVBERg==")
  })

  test("decodes back to the same bytes", () => {
    expect(Array.from(new Uint8Array(base64ToBytes("JVBERg==")))).toEqual([37, 80, 68, 70])
  })

  test("round-trips every byte value", () => {
    const all = Array.from({ length: 256 }, (_unused, index) => index)

    expect(Array.from(new Uint8Array(base64ToBytes(bytesToBase64(bufferOf(all)))))).toEqual(all)
  })

  test("round-trips an empty buffer", () => {
    expect(bytesToBase64(new ArrayBuffer(0))).toBe("")
    expect(base64ToBytes("").byteLength).toBe(0)
  })

  test("round-trips a large file without running out of stack", () => {
    const big = new Uint8Array(2_000_000).map((_unused, index) => index % 251)

    const back = new Uint8Array(base64ToBytes(bytesToBase64(big.buffer)))

    expect(back.length).toBe(big.length)
    expect(back[1_999_999]).toBe(big[1_999_999])
  })
})
