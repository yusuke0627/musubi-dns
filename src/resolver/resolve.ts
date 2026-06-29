import { encodeHeader, encodeQuestion } from "../dns/encoder";
import { decodeHeader, decodeQuestion, decodeResourceRecord } from "../dns/decoder";
import type { DNSPacket } from "../dns/types";
import { sendQuery } from "../transport/udp";

export async function resolveDomain(
  name: string,
  type: number,
  sendQueryImpl: typeof sendQuery = sendQuery,
  dnsServer: string = "8.8.8.8",
  dnsPort: number = 53,
  timeoutMs: number = 5000
): Promise<DNSPacket> {
  // Generate random ID (0-65535)
  const id = Math.floor(Math.random() * 65536);

  // Build header
  const header = encodeHeader({
    id,
    qr: 0,
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
  });

  // Build question
  const questionBuf = new Uint8Array(256);
  const questionLen = encodeQuestion(
    { name, type, class: 1 },
    questionBuf,
    0
  );

  // Combine packet
  const packet = new Uint8Array(header.length + questionLen);
  packet.set(header, 0);
  packet.set(questionBuf.slice(0, questionLen), header.length);

  // Send and receive
  const response = await sendQueryImpl(dnsServer, dnsPort, packet, timeoutMs);

  // Decode response
  const decodedHeader = decodeHeader(response, 0);
  let offset = 12;

  // Decode questions
  const questions = [];
  for (let i = 0; i < decodedHeader.qdcount; i++) {
    const q = decodeQuestion(response, offset);
    questions.push(q.question);
    offset = q.offset;
  }

  // Decode answers
  const answers = [];
  for (let i = 0; i < decodedHeader.ancount; i++) {
    const rr = decodeResourceRecord(response, offset);
    answers.push(rr.rr);
    offset = rr.offset;
  }

  // Decode authorities
  const authorities = [];
  for (let i = 0; i < decodedHeader.nscount; i++) {
    const rr = decodeResourceRecord(response, offset);
    authorities.push(rr.rr);
    offset = rr.offset;
  }

  // Decode additionals
  const additionals = [];
  for (let i = 0; i < decodedHeader.arcount; i++) {
    const rr = decodeResourceRecord(response, offset);
    additionals.push(rr.rr);
    offset = rr.offset;
  }

  return {
    header: decodedHeader,
    questions,
    answers,
    authorities,
    additionals,
    raw: response,
  };
}
