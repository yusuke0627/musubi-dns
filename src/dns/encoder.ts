import type { DNSHeader, DNSQuestion, DNSResourceRecord } from "./types";

export function encodeHeader(header: DNSHeader): Uint8Array {
  const buf = new Uint8Array(12);
  const view = new DataView(buf.buffer);

  // ID (2 bytes)
  view.setUint16(0, header.id, false); // big-endian

  // Flags (2 bytes)
  let flags = 0;
  flags |= (header.qr & 1) << 15;
  flags |= (header.opcode & 0x0f) << 11;
  flags |= (header.aa ? 1 : 0) << 10;
  flags |= (header.tc ? 1 : 0) << 9;
  flags |= (header.rd ? 1 : 0) << 8;
  flags |= (header.ra ? 1 : 0) << 7;
  flags |= (header.z & 0x07) << 4;
  flags |= header.rcode & 0x0f;
  view.setUint16(2, flags, false);

  // Counts (各2 bytes)
  view.setUint16(4, header.qdcount, false);
  view.setUint16(6, header.ancount, false);
  view.setUint16(8, header.nscount, false);
  view.setUint16(10, header.arcount, false);

  return buf;
}

export function encodeName(
  name: string,
  buf: Uint8Array,
  offset: number,
  compressionMap?: Map<string, number>
): number {
  if (name === "") return 0;

  // Root domain
  if (name === ".") {
    buf[offset] = 0x00;
    return 1;
  }

  // Check compression map
  if (compressionMap && compressionMap.has(name)) {
    const ptr = compressionMap.get(name)!;
    buf[offset] = 0xc0 | ((ptr >> 8) & 0x3f);
    buf[offset + 1] = ptr & 0xff;
    return 2;
  }

  // Record position for compression
  if (compressionMap) {
    compressionMap.set(name, offset);
  }

  const labels = name.split(".");
  let written = 0;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label === "") continue;

    const len = label.length;
    buf[offset + written] = len;
    written++;

    for (let j = 0; j < len; j++) {
      buf[offset + written] = label.charCodeAt(j);
      written++;
    }
  }

  buf[offset + written] = 0x00;
  written++;

  return written;
}

export function encodeQuestion(
  question: DNSQuestion,
  buf: Uint8Array,
  offset: number,
  compressionMap?: Map<string, number>
): number {
  let written = encodeName(question.name, buf, offset, compressionMap);

  const view = new DataView(buf.buffer);
  view.setUint16(offset + written, question.type, false);
  written += 2;

  view.setUint16(offset + written, question.class, false);
  written += 2;

  return written;
}

export function encodeResourceRecord(
  rr: DNSResourceRecord,
  buf: Uint8Array,
  offset: number,
  compressionMap?: Map<string, number>
): number {
  let written = encodeName(rr.name, buf, offset, compressionMap);

  const view = new DataView(buf.buffer);
  view.setUint16(offset + written, rr.type, false);
  written += 2;

  view.setUint16(offset + written, rr.class, false);
  written += 2;

  view.setUint32(offset + written, rr.ttl, false);
  written += 4;

  view.setUint16(offset + written, rr.rdata.length, false);
  written += 2;

  for (let i = 0; i < rr.rdata.length; i++) {
    buf[offset + written + i] = rr.rdata[i];
  }
  written += rr.rdata.length;

  return written;
}
