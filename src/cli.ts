import { resolveDomain } from "./resolver/resolve";
import { decodeName } from "./dns/decoder";
import { TYPE_A, TYPE_AAAA, TYPE_CNAME, TYPE_MX, TYPE_NS, TYPE_TXT } from "./dns/record-types";

const TYPE_MAP: Record<string, number> = {
  A: TYPE_A,
  AAAA: TYPE_AAAA,
  CNAME: TYPE_CNAME,
  MX: TYPE_MX,
  NS: TYPE_NS,
  TXT: TYPE_TXT,
};

function typeName(type: number): string {
  const entry = Object.entries(TYPE_MAP).find(([, v]) => v === type);
  return entry ? entry[0] : `TYPE${type}`;
}

function formatRdata(type: number, rdata: Uint8Array, packet?: Uint8Array, rdataOffset?: number): string {
  switch (type) {
    case TYPE_A:
      return Array.from(rdata).join(".");
    case TYPE_AAAA: {
      const hex = Array.from(rdata)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const groups = [];
      for (let i = 0; i < hex.length; i += 4) {
        groups.push(hex.slice(i, i + 4));
      }
      return groups.join(":");
    }
    case TYPE_MX: {
      if (rdata.length < 2 || rdataOffset === undefined || !packet) return "";
      const preference = (rdata[0] << 8) | rdata[1];
      const { name } = decodeName(packet, rdataOffset + 2);
      return `${preference} ${name}`;
    }
    case TYPE_TXT: {
      // Parse length-prefixed strings
      let offset = 0;
      const strings = [];
      while (offset < rdata.length) {
        const len = rdata[offset];
        offset++;
        const text = new TextDecoder().decode(rdata.slice(offset, offset + len));
        strings.push(`"${text}"`);
        offset += len;
      }
      return strings.join(" ");
    }
    default:
      return Array.from(rdata)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: bun run src/cli.ts <domain> [type]");
    process.exit(1);
  }

  const domain = args[0];
  const typeStr = (args[1] || "A").toUpperCase();
  const type = TYPE_MAP[typeStr];

  if (type === undefined) {
    console.error(`Unknown record type: ${typeStr}`);
    process.exit(1);
  }

  console.log(`; musubi-dns dig`);
  console.log(`; ${domain} ${typeStr}`);

  try {
    const result = await resolveDomain(domain, type);

    const status = result.header.rcode === 0 ? "NOERROR" : `RCODE:${result.header.rcode}`;
    console.log(`;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${result.header.id}`);
    const flags = [];
    if (result.header.qr) flags.push("qr");
    if (result.header.rd) flags.push("rd");
    if (result.header.ra) flags.push("ra");
    console.log(
      `;; flags: ${flags.join(" ")}; QUERY: ${result.header.qdcount}, ANSWER: ${result.header.ancount}, AUTHORITY: ${result.header.nscount}, ADDITIONAL: ${result.header.arcount}`
    );
    console.log();

    if (result.questions.length > 0) {
      console.log(";; QUESTION SECTION:");
      for (const q of result.questions) {
        console.log(`;${q.name.padEnd(20)} ${"IN".padEnd(5)} ${typeName(q.type)}`);
      }
      console.log();
    }

    if (result.answers.length > 0) {
      console.log(";; ANSWER SECTION:");
      for (const rr of result.answers) {
        const rdata = formatRdata(rr.type, rr.rdata, result.raw, rr.rdataOffset);
        console.log(
          `${rr.name.padEnd(20)} ${rr.ttl.toString().padEnd(6)} IN ${typeName(rr.type).padEnd(6)} ${rdata}`
        );
      }
      console.log();
    }

    if (result.authorities.length > 0) {
      console.log(";; AUTHORITY SECTION:");
      for (const rr of result.authorities) {
        const rdata = formatRdata(rr.type, rr.rdata, result.raw, rr.rdataOffset);
        console.log(
          `${rr.name.padEnd(20)} ${rr.ttl.toString().padEnd(6)} IN ${typeName(rr.type).padEnd(6)} ${rdata}`
        );
      }
      console.log();
    }

    if (result.additionals.length > 0) {
      console.log(";; ADDITIONAL SECTION:");
      for (const rr of result.additionals) {
        const rdata = formatRdata(rr.type, rr.rdata, result.raw, rr.rdataOffset);
        console.log(
          `${rr.name.padEnd(20)} ${rr.ttl.toString().padEnd(6)} IN ${typeName(rr.type).padEnd(6)} ${rdata}`
        );
      }
      console.log();
    }
  } catch (err) {
    console.error(`;; ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
