/**
 * DNS Packet Types (RFC 1035)
 */

export interface DNSHeader {
  id: number;
  qr: 0 | 1;
  opcode: number;
  aa: boolean;
  tc: boolean;
  rd: boolean;
  ra: boolean;
  z: number;
  rcode: number;
  qdcount: number;
  ancount: number;
  nscount: number;
  arcount: number;
}

export interface DNSQuestion {
  name: string;
  type: number;
  class: number;
}

export interface DNSResourceRecord {
  name: string;
  type: number;
  class: number;
  ttl: number;
  rdata: Uint8Array;
}

export interface DNSPacket {
  header: DNSHeader;
  questions: DNSQuestion[];
  answers: DNSResourceRecord[];
  authorities: DNSResourceRecord[];
  additionals: DNSResourceRecord[];
}
