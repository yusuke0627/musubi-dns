import { test, expect } from "bun:test";
import { encodeHeader, encodeName, encodeQuestion, encodeResourceRecord } from "../../src/dns/encoder";
import { decodeHeader, decodeName, decodeQuestion, decodeResourceRecord } from "../../src/dns/decoder";

test("round-trip: header encode/decode", () => {
  const header = {
    id: 0x1234,
    qr: 0 as 0 | 1,
    opcode: 0,
    aa: false,
    tc: false,
    rd: true,
    ra: false,
    z: 0,
    rcode: 0,
    qdcount: 1,
    ancount: 0,
    nscount: 0,
    arcount: 0,
  };
  const encoded = encodeHeader(header);
  const decoded = decodeHeader(encoded, 0);
  expect(decoded).toEqual(header);
});

test("round-trip: name encode/decode", () => {
  const buf = new Uint8Array(100);
  const original = "example.com";
  const len = encodeName(original, buf, 0);
  const decoded = decodeName(buf, 0);
  expect(decoded.name).toBe(original);
  expect(decoded.offset).toBe(len);
});

test("round-trip: question encode/decode", () => {
  const buf = new Uint8Array(100);
  const original = { name: "example.com", type: 1, class: 1 };
  const len = encodeQuestion(original, buf, 0);
  const decoded = decodeQuestion(buf, 0);
  expect(decoded.question).toEqual(original);
  expect(decoded.offset).toBe(len);
});

test("round-trip: A record encode/decode", () => {
  const buf = new Uint8Array(100);
  const original = {
    name: "example.com",
    type: 1,
    class: 1,
    ttl: 3600,
    rdata: new Uint8Array([93, 184, 216, 34]),
  };
  const len = encodeResourceRecord(original, buf, 0);
  const decoded = decodeResourceRecord(buf, 0);
  expect(decoded.rr.name).toBe(original.name);
  expect(decoded.rr.type).toBe(original.type);
  expect(decoded.rr.class).toBe(original.class);
  expect(decoded.rr.ttl).toBe(original.ttl);
  expect(decoded.rr.rdata).toEqual(original.rdata);
  expect(decoded.offset).toBe(len);
});

test("round-trip: full query packet", () => {
  // Build a query packet manually
  const packet = new Uint8Array(100);
  const header = {
    id: 0x1234,
    qr: 0 as 0 | 1,
    opcode: 0,
    aa: false,
    tc: false,
    rd: true,
    ra: false,
    z: 0,
    rcode: 0,
    qdcount: 1,
    ancount: 0,
    nscount: 0,
    arcount: 0,
  };

  let offset = 0;
  const headerBytes = encodeHeader(header);
  packet.set(headerBytes, offset);
  offset += 12;

  const question = { name: "example.com", type: 1, class: 1 };
  offset += encodeQuestion(question, packet, offset);

  // Decode and verify
  const decodedHeader = decodeHeader(packet, 0);
  expect(decodedHeader.id).toBe(0x1234);
  expect(decodedHeader.qdcount).toBe(1);

  const decodedQuestion = decodeQuestion(packet, 12);
  expect(decodedQuestion.question.name).toBe("example.com");
  expect(decodedQuestion.question.type).toBe(1);
  expect(decodedQuestion.question.class).toBe(1);
});
