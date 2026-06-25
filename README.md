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
