# Plan: DNS Packet Encoder/Decoder (Issue #2)

## Goal

RFC 1035 に準拠した DNS メッセージのエンコード・デコーダーをゼロから実装する。

## Current Context

- リポジトリ: `yusuke0627/musubi-dns`
- ブランチ: `feat/2-dns-packet`
- 現在のファイル: 初期セットアップのみ（`index.ts`, `README.md`, `tsconfig.json` など）
- `src/` と `tests/` のディレクトリはまだ作成されていない

## DNS Message Structure (RFC 1035)

```
+---------------------+
|        Header       |  12 bytes
+---------------------+
|       Question      |  variable
+---------------------+
|        Answer       |  variable
+---------------------+
|      Authority      |  variable
+---------------------+
|      Additional     |  variable
+---------------------+
```

### Header Section (12 bytes)

| Field | Size | Description |
|-------|------|-------------|
| ID | 16 bits | Query identifier |
| QR | 1 bit | 0=query, 1=response |
| Opcode | 4 bits | 0=standard query |
| AA | 1 bit | Authoritative Answer |
| TC | 1 bit | Truncated |
| RD | 1 bit | Recursion Desired |
| RA | 1 bit | Recursion Available |
| Z | 3 bits | Reserved (0) |
| RCODE | 4 bits | Response code (0=NOERROR) |
| QDCOUNT | 16 bits | Number of questions |
| ANCOUNT | 16 bits | Number of answers |
| NSCOUNT | 16 bits | Number of authority records |
| ARCOUNT | 16 bits | Number of additional records |

### Domain Name Encoding

- ラベル長 + ラベル文字列を繰り返す
- 終端は `0x00`
- **Pointer compression**: `0b11xxxxxx xxxxxxxx` で既存ラベルを参照

### Question Section

| Field | Size | Description |
|-------|------|-------------|
| QNAME | variable | Domain name |
| QTYPE | 16 bits | Query type (A=1, AAAA=28, etc.) |
| QCLASS | 16 bits | Query class (IN=1) |

### Resource Record

| Field | Size | Description |
|-------|------|-------------|
| NAME | variable | Domain name |
| TYPE | 16 bits | Record type |
| CLASS | 16 bits | Record class |
| TTL | 32 bits | Time to live |
| RDLENGTH | 16 bits | RDATA length |
| RDATA | variable | Record data |

## Proposed Approach

### File Structure

```
src/
  dns/
    types.ts          # DNSパケット型定義
    record-types.ts   # レコードタイプ定数・マッピング
    encoder.ts        # エンコード関数
    decoder.ts        # デコード関数
  index.ts            # エントリーポイント

tests/
  dns/
    packet.test.ts    # 統合テスト（query/response round-trip）
    encoder.test.ts   # エンコーダーテスト
    decoder.test.ts   # デコーダーテスト
```

### Types (`src/dns/types.ts`)

```typescript
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
```

### Record Types (`src/dns/record-types.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| TYPE_A | 1 | IPv4 address |
| TYPE_NS | 2 | Name server |
| TYPE_CNAME | 5 | Canonical name |
| TYPE_SOA | 6 | Start of authority |
| TYPE_PTR | 12 | Pointer |
| TYPE_MX | 15 | Mail exchange |
| TYPE_TXT | 16 | Text |
| TYPE_AAAA | 28 | IPv6 address |

| Class | Value |
|-------|-------|
| CLASS_IN | 1 |

### Encoder (`src/dns/encoder.ts`)

- `encodePacket(packet: DNSPacket): Uint8Array`
- `encodeHeader(header: DNSHeader, view: DataView, offset: number): number`
- `encodeName(name: string, buffer: Uint8Array, offset: number, compressionMap?: Map<string, number>): number`
- `encodeQuestion(question: DNSQuestion, ...): number`
- `encodeResourceRecord(rr: DNSResourceRecord, ...): number`

### Decoder (`src/dns/decoder.ts`)

- `decodePacket(buffer: Uint8Array): DNSPacket`
- `decodeHeader(view: DataView, offset: number): { header: DNSHeader; offset: number }`
- `decodeName(buffer: Uint8Array, offset: number): { name: string; offset: number }`
- `decodeQuestion(buffer: Uint8Array, offset: number): { question: DNSQuestion; offset: number }`
- `decodeResourceRecord(buffer: Uint8Array, offset: number): { rr: DNSResourceRecord; offset: number }`

## Step-by-Step Plan

1. **Create directories**: `src/dns/`, `tests/dns/`
2. **Implement types**: `src/dns/types.ts`, `src/dns/record-types.ts`
3. **Implement encoder**: `src/dns/encoder.ts`
4. **Write encoder tests**: `tests/dns/encoder.test.ts`
5. **Implement decoder**: `src/dns/decoder.ts`
6. **Write decoder tests**: `tests/dns/decoder.test.ts`
7. **Write integration tests**: `tests/dns/packet.test.ts`
8. **Run all tests**: `bun test`
9. **Update `index.ts`**: 簡易デモ（`example.com` A record query encode → decode）
10. **Commit & push**

## Tests / Validation

### Encoder Tests

- Header encode: 12 bytes、各フィールド正しく配置
- Name encode: `example.com` → `0x07 0x65 0x78 0x61 0x6d 0x70 0x6c 0x65 0x03 0x63 0x6f 0x6d 0x00`
- Name encode with compression: 2回目の `example.com` → pointer `0xc0 0x0c`
- Question encode: name + type(2) + class(2)

### Decoder Tests

- Header decode: 12 bytes → DNSHeader オブジェクト
- Name decode: ラベル形式 → 文字列
- Name decode with pointer: pointer を追跡して正しい name を取得
- Question decode
- Resource record decode

### Integration Tests

- Round-trip: encode → decode → 元のオブジェクトと一致
- `example.com` A record query packet
- Response packet with A record `93.184.216.34`
- Response packet with CNAME + A record (pointer compression 必須)

## Risks, Tradeoffs, and Open Questions

| # | 質問 | 提案 |
|---|------|------|
| 1 | AAAAレコードのRDATA形式 | IPv6 アドレスを16バイト固定で扱う |
| 2 | TXTレコードのRDATA | 1バイト長プレフィックス + 文字列 |
| 3 | MXレコードのRDATA | 2バイト優先度 + ドメイン名 |
| 4 | CNAME/NS/MX のRDATA | ドメイン名（ポインタ圧縮対応） |
| 5 | エラーハンドリング | 不正なパケットは `Error` を投げる |

## Implementation Order

TDD で進める。テスト → RED → 実装 → GREEN → リファクタ。

1. `src/dns/types.ts` + `src/dns/record-types.ts`（型だけ、テスト不要）
2. `tests/dns/encoder.test.ts` → `src/dns/encoder.ts`
3. `tests/dns/decoder.test.ts` → `src/dns/decoder.ts`
4. `tests/dns/packet.test.ts`（統合テスト）

## Branch

`feat/2-dns-packet`

## Acceptance Criteria

- [ ] `bun test` passes all packet encode/decode tests
- [ ] Can encode a query for `example.com` A record
- [ ] Can decode a response with A record `93.184.216.34`
- [ ] Can handle domain name pointer compression
- [ ] Atomic commits with clear messages
