import { test, expect } from "bun:test";
import { resolveDomain } from "../../src/resolver/resolve";
import { TYPE_A } from "../../src/dns/record-types";

test("resolveDomain builds correct query packet", async () => {
  let capturedPacket: Uint8Array | null = null;

  const mockSendQuery = async (_host: string, _port: number, packet: Uint8Array, _timeout?: number): Promise<Uint8Array> => {
    capturedPacket = packet;
    // Return a mock response
    return new Uint8Array([
      // Header: QR=1, ANCOUNT=1
      0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      // Question: example.com A
      0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d, 0x00,
      0x00, 0x01, 0x00, 0x01,
      // Answer: example.com A 93.184.216.34
      0xc0, 0x0c, // pointer to question name
      0x00, 0x01, // TYPE A
      0x00, 0x01, // CLASS IN
      0x00, 0x00, 0x0e, 0x10, // TTL 3600
      0x00, 0x04, // RDLENGTH 4
      0x5d, 0xb8, 0xd8, 0x22, // 93.184.216.34
    ]);
  };

  const result = await resolveDomain("example.com", TYPE_A, mockSendQuery);

  // Verify query packet was built correctly
  expect(capturedPacket).not.toBeNull();
  expect(capturedPacket!.length).toBeGreaterThanOrEqual(12);
  // QR=0 (query), RD=1
  expect(capturedPacket![2] & 0x80).toBe(0); // QR bit
  expect(capturedPacket![2] & 0x01).toBe(1); // RD bit
  // QDCOUNT=1
  expect(capturedPacket![4]).toBe(0);
  expect(capturedPacket![5]).toBe(1);

  // Verify response was decoded
  expect(result.header.qr).toBe(1);
  expect(result.header.ancount).toBe(1);
  expect(result.answers.length).toBe(1);
  expect(result.answers[0].name).toBe("example.com");
  expect(result.answers[0].type).toBe(TYPE_A);
  expect(result.answers[0].rdata).toEqual(new Uint8Array([0x5d, 0xb8, 0xd8, 0x22]));
});

test("resolveDomain returns NXDOMAIN error", async () => {
  const mockSendQuery = async (): Promise<Uint8Array> => {
    return new Uint8Array([
      // Header: QR=1, RCODE=3 (NXDOMAIN)
      0x12, 0x34, 0x81, 0x83, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      // Question: does-not-exist.com A
      0x0c, 0x64, 0x6f, 0x65, 0x73, 0x2d, 0x6e, 0x6f, 0x74, 0x2d, 0x65, 0x78, 0x69, 0x73, 0x74,
      0x03, 0x63, 0x6f, 0x6d, 0x00,
      0x00, 0x01, 0x00, 0x01,
    ]);
  };

  const result = await resolveDomain("does-not-exist.com", TYPE_A, mockSendQuery);
  expect(result.header.rcode).toBe(3); // NXDOMAIN
  expect(result.answers.length).toBe(0);
});
