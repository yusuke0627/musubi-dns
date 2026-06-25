/**
 * DNS Record Type and Class constants (RFC 1035)
 */

export const TYPE_A = 1;
export const TYPE_NS = 2;
export const TYPE_CNAME = 5;
export const TYPE_SOA = 6;
export const TYPE_PTR = 12;
export const TYPE_MX = 15;
export const TYPE_TXT = 16;
export const TYPE_AAAA = 28;

export const CLASS_IN = 1;

export function typeToString(type: number): string {
  switch (type) {
    case TYPE_A: return "A";
    case TYPE_NS: return "NS";
    case TYPE_CNAME: return "CNAME";
    case TYPE_SOA: return "SOA";
    case TYPE_PTR: return "PTR";
    case TYPE_MX: return "MX";
    case TYPE_TXT: return "TXT";
    case TYPE_AAAA: return "AAAA";
    default: return `TYPE${type}`;
  }
}
