import { test, expect } from "bun:test";
import { encodeHeader, encodeName, encodeQuestion, encodeResourceRecord } from "../../src/dns/encoder";

test("encodeHeader creates 12 bytes", () => {
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
  const buf = encodeHeader(header);
  expect(buf.length).toBe(12);
});

test("encodeHeader sets ID correctly", () => {
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
  const buf = encodeHeader(header);
  expect(buf[0]).toBe(0x12);
  expect(buf[1]).toBe(0x34);
});

test("encodeHeader sets QR and RD flags", () => {
  const header = {
    id: 0x0000,
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
  const buf = encodeHeader(header);
  expect(buf[2]).toBe(0x01);
  expect(buf[3]).toBe(0x00);
});

test("encodeHeader sets QDCOUNT", () => {
  const header = {
    id: 0x0000,
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
  const buf = encodeHeader(header);
  expect(buf[4]).toBe(0x00);
  expect(buf[5]).toBe(0x01);
});

// encodeName tests
test("encodeName encodes example.com correctly", () => {
  const buf = new Uint8Array(100);
  const len = encodeName("example.com", buf, 0);
  expect(len).toBe(13);
  expect(buf[0]).toBe(0x07);
  expect(buf.slice(1, 8)).toEqual(new Uint8Array([0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65]));
  expect(buf[8]).toBe(0x03);
  expect(buf.slice(9, 12)).toEqual(new Uint8Array([0x63, 0x6f, 0x6d]));
  expect(buf[12]).toBe(0x00);
});

test("encodeName encodes root domain as single zero byte", () => {
  const buf = new Uint8Array(10);
  const len = encodeName(".", buf, 0);
  expect(len).toBe(1);
  expect(buf[0]).toBe(0x00);
});

test("encodeName uses pointer compression on second occurrence", () => {
  const buf = new Uint8Array(100);
  const compressionMap = new Map<string, number>();
  const len1 = encodeName("example.com", buf, 0, compressionMap);
  expect(len1).toBe(13);
  expect(compressionMap.get("example.com")).toBe(0);
  const len2 = encodeName("example.com", buf, 13, compressionMap);
  expect(len2).toBe(2);
  expect(buf[13]).toBe(0xc0);
  expect(buf[14]).toBe(0x00);
});

test("encodeName returns 0 for empty string", () => {
  const buf = new Uint8Array(10);
  const len = encodeName("", buf, 0);
  expect(len).toBe(0);
});

// encodeQuestion tests
test("encodeQuestion encodes A record query for example.com", () => {
  const buf = new Uint8Array(100);
  const question = { name: "example.com", type: 1, class: 1 };
  const len = encodeQuestion(question, buf, 0);
  expect(len).toBe(17);
  const view = new DataView(buf.buffer);
  expect(view.getUint16(13, false)).toBe(1);
  expect(view.getUint16(15, false)).toBe(1);
});

// encodeResourceRecord tests
test("encodeResourceRecord encodes A record", () => {
  const buf = new Uint8Array(100);
  const rr = {
    name: "example.com",
    type: 1,
    class: 1,
    ttl: 3600,
    rdata: new Uint8Array([93, 184, 216, 34]),
  };
  const len = encodeResourceRecord(rr, buf, 0);
  // name(13) + type(2) + class(2) + ttl(4) + rdlength(2) + rdata(4) = 27
  expect(len).toBe(27);
  const view = new DataView(buf.buffer);
  expect(view.getUint16(13, false)).toBe(1); // type A
  expect(view.getUint16(15, false)).toBe(1); // class IN
  expect(view.getUint32(17, false)).toBe(3600); // ttl
  expect(view.getUint16(21, false)).toBe(4); // rdlength
  expect(buf[23]).toBe(93);
  expect(buf[24]).toBe(184);
  expect(buf[25]).toBe(216);
  expect(buf[26]).toBe(34);
});

test("encodeResourceRecord encodes CNAME record", () => {
  const buf = new Uint8Array(100);
  const rdata = new Uint8Array(14);
  encodeName("example.com", rdata, 0);
  const rr = {
    name: "www.example.com",
    type: 5,
    class: 1,
    ttl: 3600,
    rdata,
  };
  const len = encodeResourceRecord(rr, buf, 0);
  expect(len).toBe(17 + 10 + 14); // name(17) + fixed(10) + rdata(14)
  const view = new DataView(buf.buffer);
  expect(view.getUint16(17, false)).toBe(5); // type CNAME at offset 17
});
