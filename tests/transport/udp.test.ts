import { test, expect } from "bun:test";
import { sendQuery } from "../../src/transport/udp";

test("sendQuery throws on timeout", async () => {
  // Use a non-routable IP that will never respond
  const packet = new Uint8Array([0x00, 0x01, 0x00, 0x00]);
  const promise = sendQuery("192.0.2.1", 53, packet, 100); // 100ms timeout
  await expect(promise).rejects.toThrow("DNS query timeout");
});

test("sendQuery resolves with response from real DNS server", async () => {
  // Build a simple query for example.com A record
  const header = new Uint8Array([
    0x12, 0x34, // ID
    0x01, 0x00, // flags: RD
    0x00, 0x01, // QDCOUNT
    0x00, 0x00, // ANCOUNT
    0x00, 0x00, // NSCOUNT
    0x00, 0x00, // ARCOUNT
  ]);
  const question = new Uint8Array([
    0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65,
    0x03, 0x63, 0x6f, 0x6d, 0x00,
    0x00, 0x01, // TYPE A
    0x00, 0x01, // CLASS IN
  ]);
  const packet = new Uint8Array(header.length + question.length);
  packet.set(header, 0);
  packet.set(question, header.length);

  const response = await sendQuery("8.8.8.8", 53, packet, 5000);

  // Response should be at least a valid DNS header (12 bytes)
  expect(response.length).toBeGreaterThanOrEqual(12);

  // Check QR bit is set (response)
  expect(response[2] & 0x80).toBe(0x80);

  // Check ID matches
  expect(response[0]).toBe(0x12);
  expect(response[1]).toBe(0x34);
}, 10000);
