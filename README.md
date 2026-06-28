# musubi-dns

Build your own DNS Resolver + Authoritative Server from scratch in TypeScript + Bun.

## Architecture Pipeline

```
Resolver:   User Query → UDP/TCP Socket → DNS Packet Encode → External DNS → Decode Response → Cache → IP
Server:     Client Query → UDP/TCP Socket → Parse Question → Zone File Lookup → Encode Response → Answer
```

## Tech Stack

- **TypeScript** — type-safe educational code
- **Bun** — fast runtime, built-in test runner
- **Raw UDP sockets** — no external DNS libraries
- **Raw TCP sockets** — for DNS over TCP fallback

## Design Principles

- **TDD**: Every issue uses Test-Driven Development
- **Small issues**: Each issue completes in one focused session
- **Incremental**: Resolver first, then Server

## Usage

```bash
bun install
bun test
```

---

## DNS Packet Specification (RFC 1035)

DNSメッセージは**1つの連続したバイナリ列**として送受信される。テキストの「行」という概念はない。

### パケット全体構造

```
+---------------------+
|        Header       |  12 bytes（固定長）
+---------------------+
|       Question      |  可変長
+---------------------+
|        Answer       |  可変長
+---------------------+
|      Authority      |  可変長
+---------------------+
|      Additional     |  可変長
+---------------------+
```

ヘッダーの `QDCOUNT` / `ANCOUNT` / `NSCOUNT` / `ARCOUNT` で、それぞれのセクションが何レコード含まれているかを示す。

### Header Section（12 bytes）

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           ID                  |QR|   Opcode  |AA|TC|RD|RA| Z  |RCODE|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           QDCOUNT             |           ANCOUNT             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           NSCOUNT             |           ARCOUNT             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

| フィールド | サイズ | 説明 |
|-----------|--------|------|
| **ID** | 16 bits | クエリ識別子。リクエストとレスポンスを対応させる |
| **QR** | 1 bit | 0=クエリ、1=レスポンス |
| **Opcode** | 4 bits | 0=標準クエリ |
| **AA** | 1 bit | 権威的回答（Authoritative Answer） |
| **TC** | 1 bit | 切り詰め（Truncated）。UDPで大きすぎる場合 |
| **RD** | 1 bit | 再帰希望（Recursion Desired） |
| **RA** | 1 bit | 再帰可能（Recursion Available） |
| **Z** | 3 bits | 予約（0） |
| **RCODE** | 4 bits | レスポンスコード。0=NOERROR |
| **QDCOUNT** | 16 bits | Questionセクションの数 |
| **ANCOUNT** | 16 bits | Answerセクションの数 |
| **NSCOUNT** | 16 bits | Authorityセクションの数 |
| **ARCOUNT** | 16 bits | Additionalセクションの数 |

### Question Section

```
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    QNAME（可変長）                      |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    QTYPE（2 bytes）                     |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    QCLASS（2 bytes）                    |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
```

| フィールド | サイズ | 説明 |
|-----------|--------|------|
| **QNAME** | 可変 | 問い合わせるドメイン名 |
| **QTYPE** | 2 bytes | 問い合わせタイプ（A=1、AAAA=28 など） |
| **QCLASS** | 2 bytes | クラス（IN=1） |

### Resource Record（Answer / Authority / Additional）

```
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    NAME（可変長）                       |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    TYPE（2 bytes）                      |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    CLASS（2 bytes）                     |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    TTL（4 bytes）                       |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                  RDLENGTH（2 bytes）  ←★鍵              |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
|                    RDATA（可変長）                      |
+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
```

| フィールド | サイズ | 説明 |
|-----------|--------|------|
| **NAME** | 可変 | ドメイン名 |
| **TYPE** | 2 bytes | レコードタイプ |
| **CLASS** | 2 bytes | クラス |
| **TTL** | 4 bytes | キャッシュ秒数 |
| **RDLENGTH** | 2 bytes | **次のRDATAが何バイトかを明示** |
| **RDATA** | RDLENGTH分 | 実際のデータ |

#### RDLENGTHが鍵となる理由

DNSパケット内の各フィールドは「固定長」か「自己記述的」かで境界が決まる：

- **固定長**: TYPE(2)、CLASS(2)、TTL(4)、RDLENGTH(2) → 長さが決まっている
- **自己記述的**: NAME → 長さプレフィックス＋終端0x00で境界が決まる
- **RDATA**: **RDLENGTHに依存**。RDLENGTHが「次のNバイトがRDATA」と教えてくれる

> RDLENGTHがないと、可変長のRDATA（MXのドメイン名やTXTの文字列など）がどこまでか永遠に分からない。

---

## ドメイン名のエンコーディング

### ラベル形式（通常時）

ドメイン名 `example.com` は次のようにエンコードされる：

```
[0x07] 'e' 'x' 'a' 'm' 'p' 'l' 'e'   ← 長さ7 + "example"
[0x03] 'c' 'o' 'm'                     ← 長さ3 + "com"
[0x00]                                 ← 終端マーカー
```

各ラベルの先頭に「このラベルは何バイトか」が書いてあり、最後の `0x00` で終端を示す。

### Pointer Compression（ポインタ圧縮）

同じドメイン名がパケット内に複数回現れる場合、**2バイトのポインタ**で既存のものを参照する。

```
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|1 1|        OFFSET             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- 先頭2ビットが `11` → 「これはポインタです」
- 残り14ビット → パケット先頭からのバイトオフセット

#### 具体例

パケット内に `www.example.com` と `example.com` が両方必要な場合：

```
Offset:  0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17
Byte:    [0x03 'w' 'w' 'w' 0xc0 0x06] [0x07 'e' 'x' 'a' 'm' 'p' 'l' 'e' 0x03 'c' 'o' 'm' 0x00]
         ↑                          ↑   ↑
         "www"                      │   "example.com"
                                    │
                                    └── ポインタ「offset 6 を見てね」
```

- `www.example.com` は `0x03 'w' 'w' 'w' 0xc0 0x06` の6バイトで表現
- `0xc0 0x06` = ポインタ。「offset 6 からのドメイン名を使ってください」
- offset 6 には `example.com` のラベル形式が始まっている

> **オフセットは「パケット全体の先頭からのバイト位置」**。レコード番号や行番号ではない。

---

## レコードタイプ一覧

| タイプ | 値 | RDATAサイズ | RDATA内容 | ポインタ圧縮 |
|--------|-----|------------|-----------|-------------|
| **A** | 1 | 4バイト固定 | IPv4アドレス | ❌ |
| **NS** | 2 | 可変 | ドメイン名 | ✅ |
| **CNAME** | 5 | 可変 | ドメイン名 | ✅ |
| **MX** | 15 | 可変 | 2バイト優先度 + ドメイン名 | ✅（ドメイン名部分） |
| **TXT** | 16 | 可変 | `<長さ><文字列>`×n | ❌ |
| **AAAA** | 28 | 16バイト固定 | IPv6アドレス | ❌ |

---

## 各レコードタイプの詳細

### A（Address）— 最も基本的な「名前→IP」

| 項目 | 内容 |
|------|------|
| **Type値** | 1 |
| **RDATA** | 4バイトのIPv4アドレス |
| **役割** | ドメイン名 → IPv4アドレス |

#### ゾーンファイル表記

```
example.com.    3600    IN    A    93.184.216.34
```

#### バイナリ表現

```
TYPE    CLASS   TTL         RDLENGTH  RDATA
00 01   00 01   00 00 0e 10  00 04     5d b8 d8 22
                    ↑                    ↑
                 3600秒               93.184.216.34
```

4バイト固定長。`93` `184` `216` `34` をそのまま並べる。

---

### AAAA（Quad-A）— IPv6の時代

| 項目 | 内容 |
|------|------|
| **Type値** | 28 |
| **RDATA** | 16バイトのIPv6アドレス |
| **役割** | ドメイン名 → IPv6アドレス |

#### ゾーンファイル表記

```
example.com.    3600    IN    AAAA    2606:2800:220:1:248:1893:25c8:1946
```

#### バイナリ表現

```
TYPE    CLASS   TTL         RDLENGTH  RDATA（16 bytes）
00 1c   00 01   00 00 0e 10  00 10     26 06 28 00 02 20 00 01 02 48 18 93 25 c8 19 46
                    ↑                    ↑
                 3600秒               2606:2800:220:1:248:1893:25c8:1946
```

16バイト固定長。IPv6アドレスを16進数のまま16バイトで並べる。

> なぜAが4つ？ — IPv4のAレコードをIPv6版として「AAAA（4倍の長さ）」と命名的な遊び心。

---

### CNAME（Canonical Name）— 別名システム

| 項目 | 内容 |
|------|------|
| **Type値** | 5 |
| **RDATA** | ドメイン名（圧縮対応） |
| **役割** | 「この名前は、あっちの別名です」 |

#### ゾーンファイル表記

```
www.example.com.    3600    IN    CNAME    example.com.
```

#### バイナリ表現

```
NAME                TYPE    CLASS   TTL         RDLENGTH  RDATA（ドメイン名）
03 77 77 77         00 05   00 01   00 00 0e 10  00 0e     07 65 78 61 6d 70 6c 65 03 63 6f 6d 00
"www"               CNAME   IN      3600秒       14 bytes   "example.com"
```

#### 重要な制約

CNAMEレコードを持つドメインは、**他のレコード（AやMXなど）を持てない**。
なぜなら「私は別名です」という宣言だから。

#### ポインタ圧縮との関係

実際のDNSレスポンスではCNAMEの後にAレコードが続くことが多い：

```
Answer Section:
  www.example.com.    CNAME    example.com.
  example.com.        A        93.184.216.34   ← 1行目のexample.comをpointer参照
```

RDATAがドメイン名なので、**pointer compressionが使える**。

---

### MX（Mail Exchange）— メールの配達先

| 項目 | 内容 |
|------|------|
| **Type値** | 15 |
| **RDATA** | 2バイト（優先度）+ ドメイン名 |
| **役割** | 「このドメインへのメールは、ここに届けて」 |

#### ゾーンファイル表記

```
example.com.    3600    IN    MX    10 mail.example.com.
example.com.    3600    IN    MX    20 mail2.example.com.
```

#### バイナリ表現

```
TYPE    CLASS   TTL         RDLENGTH  RDATA
00 0f   00 01   00 00 0e 10  00 11     00 0a 04 6d 61 69 6c 07 65 78 61 6d 70 6c 65 03 63 6f 6d 00
                    ↑                    ↑    ↑    ↑
                 3600秒               17B   10   "mail.example.com"
                                      優先度
```

#### 優先度（Preference）

- 小さい数字ほど優先
- 10がダメなら20にフォールバック
- 複数のMXレコードで負荷分散や冗長化を実現

#### RDATA構造

```
[0x00 0x0a]              ← 優先度: 10（2バイト）
[0x04 'm' 'a' 'i' 'l']   ← "mail"
[0x07 'e' 'x' 'a' ...]   ← "example"
[0x03 'c' 'o' 'm']       ← "com"
[0x00]                   ← 終端
```

優先度は固定2バイト、その後のドメイン名部分は**pointer compression対象**。

---

### NS（Name Server）— 権威の所在

| 項目 | 内容 |
|------|------|
| **Type値** | 2 |
| **RDATA** | ドメイン名（圧縮対応） |
| **役割** | 「このドメインの権威サーバーはここ」 |

#### ゾーンファイル表記

```
example.com.    3600    IN    NS    ns1.example.com.
example.com.    3600    IN    NS    ns2.example.com.
```

#### バイナリ表現

```
TYPE    CLASS   TTL         RDLENGTH  RDATA（ドメイン名）
00 02   00 01   00 00 0e 10  00 11     04 6e 73 31 07 65 78 61 6d 70 6c 65 03 63 6f 6d 00
                    ↑                    ↑
                 3600秒               "ns1.example.com"
```

#### なぜ重要か

再帰的リゾルバーが「次にどのサーバーに聞けばいいか」を知るための鍵。
ルートDNS → TLDサーバー → 権威サーバー と辿る際に、NSレコードが道しるべとなる。

---

### TXT（Text）— 自由記述欄

| 項目 | 内容 |
|------|------|
| **Type値** | 16 |
| **RDATA** | 1バイト（長さ）+ 文字列（複数可） |
| **役割** | 任意のテキスト情報 |

#### ゾーンファイル表記

```
example.com.    3600    IN    TXT    "v=spf1 include:_spf.google.com ~all"
example.com.    3600    IN    TXT    "google-site-verification=abc123"
```

#### バイナリ表現

```
TYPE    CLASS   TTL         RDLENGTH  RDATA
00 10   00 01   00 00 0e 10  00 2a     2a 76 3d 73 70 66 31 20 69 6e 63 6c 75 64 65 3a 5f 73 70 66 2e 67 6f 6f 67 6c 65 2e 63 6f 6d 20 7e 61 6c 6c
                    ↑                    ↑    ↑
                 3600秒               42B   長さ42
                                      "v=spf1 include:_spf.google.com ~all"
```

#### RDATA構造

TXTレコードのRDATAは「文字列の配列」として設計されている：

```
[<length_1> <text_1>] [<length_2> <text_2>] ...
```

- 各文字列は **1バイトの長さプレフィックス** + 実際の文字列
- 255バイトを超える文字列は複数の`<length><text>`に分割される
- 現実のDNSではほとんど1つの文字列のみ

#### 使われ方

- **SPF**（Sender Policy Framework）: メール送信元の正当性確認
- **DKIM** / **DMARC**: メール認証
- **Googleサイト認証**: Webマスターツール所有権確認
- その他、サービス提供者が任意のデータを格納

---

## プロジェクト構造

```
src/
  dns/
    types.ts          # DNSパケット型定義
    record-types.ts   # レコードタイプ定数
    encoder.ts        # エンコーダー
    decoder.ts        # デコーダー
tests/
  dns/
    encoder.test.ts   # エンコーダーテスト
    decoder.test.ts   # デコーダーテスト
    packet.test.ts    # 統合テスト（round-trip）
```

---

## テスト実行

```bash
bun test
```

22 tests, 0 fail, 72 expect() calls
