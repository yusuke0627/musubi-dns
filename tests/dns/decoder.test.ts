import { test, expect } from "bun:test";
import { decodeHeader, decodeName, decodeQuestion, decodeResourceRecord } from "../../src/dns/decoder";

test("decodeHeader parses 12 bytes correctly", () => {
  const buf = new Uint8Array([0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const header = decodeHeader(buf, 0);
  expect(header.id).toBe(0x1234);
  expect(header.qr).toBe(0);
  expect(header.rd).toBe(true);
  expect(header.qdcount).toBe(1);
  expect(header.ancount).toBe(0);
});

test("decodeHeader parses response flags", () => {
  const buf = new Uint8Array([0x00, 0x00, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
  const header = decodeHeader(buf, 0);
  expect(header.qr).toBe(1);
  expect(header.ra).toBe(true);
  expect(header.qdcount).toBe(1);
  expect(header.ancount).toBe(1);
});

test("decodeName parses example.com", () => {
  const buf = new Uint8Array([0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d, 0x00]);
  const result = decodeName(buf, 0);
  expect(result.name).toBe("example.com");
  expect(result.offset).toBe(13);
});

test("decodeName follows pointer compression", () => {
  const buf = new Uint8Array([
    0x03, 0x77, 0x77, 0x77, // "www" at offset 0
    0xc0, 0x06,              // pointer to offset 6
    0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example" at offset 6
    0x03, 0x63, 0x6f, 0x6d, // "com" at offset 14
    0x00,                    // terminator at offset 17
  ]);
  const result = decodeName(buf, 0);
  expect(result.name).toBe("www.example.com");
  expect(result.offset).toBe(6); // after pointer (2 bytes)
});

test("decodeQuestion parses A record query", () => {
  const buf = new Uint8Array([
    0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d, 0x00,
    0x00, 0x01, // type A
    0x00, 0x01, // class IN
  ]);
  const result = decodeQuestion(buf, 0);
  expect(result.question.name).toBe("example.com");
  expect(result.question.type).toBe(1);
  expect(result.question.class).toBe(1);
  expect(result.offset).toBe(17);
});

test("decodeResourceRecord parses A record", () => {
  const buf = new Uint8Array([
    0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d, 0x00, // name
    0x00, 0x01, // type A
    0x00, 0x01, // class IN
    0x00, 0x00, 0x0e, 0x10, // ttl 3600
    0x00, 0x04, // rdlength 4
    0x5d, 0xb8, 0xd8, 0x22, // 93.184.216.34
  ]);
  const result = decodeResourceRecord(buf, 0);
  expect(result.rr.name).toBe("example.com");
  expect(result.rr.type).toBe(1);
  expect(result.rr.ttl).toBe(3600);
  expect(result.rr.rdata).toEqual(new Uint8Array([0x5d, 0xb8, 0xd8, 0x22]));
});
