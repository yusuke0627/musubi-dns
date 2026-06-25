# 今日の振り返り（2026-06-25）

## 今日やったこと

1. `musubi-dns` リポジトリ作成
2. Issue #1（ROADMAP）、Issue #2（DNS Packet Encoder/Decoder）作成
3. `feat/2-dns-packet` ブランチで実装
4. README に DNS パケット仕様・各レコードタイプ詳細を追加
5. PR #3 作成

---

## 核心的な学び（特にやり取りした部分）

### 1. DNS パケットは「1つの連続したバイナリ列」

テキストの「行」や「セクションの区切り」などはない。
ヘッダーの `~COUNT` で「次のセクションに何個レコードが入っているか」を知り、
その個数分だけ読み進めていく。

### 2. COUNT は「個数」であって「バイト数」ではない

| フィールド | 意味 |
|-----------|------|
| **QDCOUNT** | Question セクションに何個の質問が入っているか |
| **ANCOUNT** | Answer セクションに何個の回答が入っているか |
| **NSCOUNT** | Authority セクションに何個の権威レコードが入っているか |
| **ARCOUNT** | Additional セクションに何個の追加レコードが入っているか |

> 各セクションは「レコードの入れ物」で、複数のレコードを含む。
> 例：Answer セクションに A レコードと AAAA レコードが両方入っている場合、ANCOUNT=2。

### 3. RDLENGTH が可変長 RDATA の境界を教える

Resource Record の構造：

```
NAME (可変長) + TYPE(2) + CLASS(2) + TTL(4) + RDLENGTH(2) + RDATA(可変長)
```

- TYPE・CLASS・TTLは固定長 → そのまま読める
- NAME は自己記述的（長さプレフィックス + 0x00 終端） → そのまま読める
- **RDATA は RDLENGTH に依存** → RDLENGTH が「次の N バイトが RDATA 」と教えてくれる

> RDLENGTH がないと、MX のドメイン名や TXT の文字列などの可変長データがどこまでか永遠に分からない。

### 4. Pointer Compression（ポインタ圧縮）

同じドメイン名がパケット内に複数回現れる時、既存のドメイン名を **2バイトのポインタ** で参照する。

```
フォーマット: 11 + 14bit offset = 2バイト固定

例: 0xc0 0x0c
  → 先頭 2bit が '11' → これはポインタ
  → 残り 14bit = 12 → パケット先頭から 12 バイト目を見ろ
```

> オフセットは「パケット全体の先頭からのバイト位置」。レコード番号や行番号ではない。

### 5. 各レコードタイプの特徴

| タイプ | 値 | RDATA サイズ | RDATA 内容 | 圧縮 |
|--------|-----|------------|-----------|------|
| **A** | 1 | 4バイト固定 | IPv4 アドレス | ❌ |
| **AAAA** | 28 | 16バイト固定 | IPv6 アドレス | ❌ |
| **NS** | 2 | 可変 | ドメイン名 | ✅ |
| **CNAME** | 5 | 可変 | ドメイン名 | ✅ |
| **MX** | 15 | 可変 | 2バイト優先度 + ドメイン名 | ✅（ドメイン名部分） |
| **TXT** | 16 | 可変 | `<長さ><文字列>`×n | ❌ |

- A/AAAA は固定長なので簡単
- NS/CNAME/MX は RDATA がドメイン名なのでポインタ圧縮が使える
- TXT は文字列の配列。255バイトを超えると分割される
- MX は優先度（2バイト）+ ドメイン名の構造

---

## 実装したファイル

```
src/
  dns/
    types.ts          # DNSHeader, DNSQuestion, DNSResourceRecord, DNSPacket 型
    record-types.ts   # A, AAAA, CNAME, MX, NS, TXT, CLASS_IN 定数
    encoder.ts        # encodeHeader, encodeName, encodeQuestion, encodeResourceRecord
    decoder.ts        # decodeHeader, decodeName, decodeQuestion, decodeResourceRecord
tests/
  dns/
    encoder.test.ts   # 11 tests
    decoder.test.ts   # 6 tests
    packet.test.ts    # 5 tests（round-trip）
```

## テスト結果

```
22 tests, 0 fail, 72 expect() calls
Ran 22 tests across 3 files.
```

全テスト通過済み。

---

## 明日以降の流れ

1. PR #3 をマージ
2. Issue #3: UDP socket send/receive に進む
   - `Bun.udpSocket()` で生の UDP ソケットを開く
   - 8.8.8.8:53 に DNS クエリを送信
   - レスポンスを受信してデコード

---

## 参考リンク

- PR #3: https://github.com/yusuke0627/musubi-dns/pull/3
- Issue #2: https://github.com/yusuke0627/musubi-dns/issues/2
- Issue #1 (ROADMAP): https://github.com/yusuke0627/musubi-dns/issues/1
