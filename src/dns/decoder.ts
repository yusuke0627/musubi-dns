import type { DNSHeader, DNSQuestion, DNSResourceRecord } from "./types";

export function decodeHeader(buf: Uint8Array, offset: number): DNSHeader {
  const view = new DataView(buf.buffer, buf.byteOffset);

  return {
    id: view.getUint16(offset, false),
    qr: ((view.getUint16(offset + 2, false) >> 15) & 1) as 0 | 1,
    opcode: (view.getUint16(offset + 2, false) >> 11) & 0x0f,
    aa: ((view.getUint16(offset + 2, false) >> 10) & 1) === 1,
    tc: ((view.getUint16(offset + 2, false) >> 9) & 1) === 1,
    rd: ((view.getUint16(offset + 2, false) >> 8) & 1) === 1,
    ra: ((view.getUint16(offset + 2, false) >> 7) & 1) === 1,
    z: (view.getUint16(offset + 2, false) >> 4) & 0x07,
    rcode: view.getUint16(offset + 2, false) & 0x0f,
    qdcount: view.getUint16(offset + 4, false),
    ancount: view.getUint16(offset + 6, false),
    nscount: view.getUint16(offset + 8, false),
    arcount: view.getUint16(offset + 10, false),
  };
}

export function decodeName(buf: Uint8Array, offset: number): { name: string; offset: number } {
  let name = "";
  let jumped = false;
  let jumpOffset = offset;

  while (true) {
    const len = buf[offset]!;

    if (len === 0) {
      offset++;
      break;
    }

    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | buf[offset + 1]!;
      if (!jumped) {
        jumpOffset = offset + 2;
        jumped = true;
      }
      offset = ptr;
      continue;
    }

    if (name !== "") {
      name += ".";
    }
    for (let i = 1; i <= len; i++) {
      name += String.fromCharCode(buf[offset + i]!);
    }
    offset += 1 + len;
  }

  return { name, offset: jumped ? jumpOffset : offset };
}

export function decodeQuestion(buf: Uint8Array, offset: number): { question: DNSQuestion; offset: number } {
  const nameResult = decodeName(buf, offset);
  offset = nameResult.offset;

  const view = new DataView(buf.buffer, buf.byteOffset);
  const type = view.getUint16(offset, false);
  offset += 2;
  const qclass = view.getUint16(offset, false);
  offset += 2;

  return {
    question: {
      name: nameResult.name,
      type,
      class: qclass,
    },
    offset,
  };
}

export function decodeResourceRecord(buf: Uint8Array, offset: number): { rr: DNSResourceRecord; offset: number } {
  const nameResult = decodeName(buf, offset);
  offset = nameResult.offset;

  const view = new DataView(buf.buffer, buf.byteOffset);
  const type = view.getUint16(offset, false);
  offset += 2;
  const rclass = view.getUint16(offset, false);
  offset += 2;
  const ttl = view.getUint32(offset, false);
  offset += 4;
  const rdlength = view.getUint16(offset, false);
  offset += 2;

  const rdata = new Uint8Array(rdlength);
  for (let i = 0; i < rdlength; i++) {
    rdata[i] = buf[offset + i]!;
  }
  offset += rdlength;

  return {
    rr: {
      name: nameResult.name,
      type,
      class: rclass,
      ttl,
      rdata,
      rdataOffset: offset - rdlength,
    },
    offset,
  };
}
