export function sendQuery(
  host: string,
  port: number,
  packet: Uint8Array,
  timeoutMs: number = 5000
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    function cleanup(socket: { close(): void }) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      socket.close();
    }

    timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(new Error("DNS query timeout"));
    }, timeoutMs);

    Bun.udpSocket({
      port: 0,
      hostname: "0.0.0.0",
      socket: {
        data(socket, data, _port, _address) {
          if (resolved) return;
          resolved = true;
          cleanup(socket);
          resolve(new Uint8Array(data));
        },
        error(socket, error) {
          if (resolved) return;
          resolved = true;
          cleanup(socket);
          reject(error);
        },
      },
    }).then((socket) => {
      try {
        socket.send(packet, port, host);
      } catch (err) {
        if (resolved) return;
        resolved = true;
        cleanup(socket);
        reject(err);
      }
    }).catch((err: Error) => {
      if (resolved) return;
      resolved = true;
      reject(err);
    });
  });
}
