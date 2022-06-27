// @ts-ignore
import { DhtNode } from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
// @ts-ignore
import createPool from "websocket-pool";
// @ts-ignore
import createRoundRobin from "@derhuerst/round-robin-scheduler";
import { Buffer } from "buffer";
import { blake2b } from "libskynet";
import { registryRead } from "libkernel";
import { errTuple } from "libskynet";

const REGISTRY_DHT_KEY = "lumeweb-dht-relay";
const IP_REGEX =
  /^(?:(?:2[0-4]\d|25[0-5]|1\d{2}|[1-9]?\d)\.){3}(?:2[0-4]\d|25[0-5]|1\d{2}|[1-9]?\d)$/;

export default class DHT {
  private _dht: DhtNode;
  private _wsPool: DhtNode;

  constructor() {
    this._wsPool = createPool(WebSocket, createRoundRobin);
    this._dht = new DhtNode(new Stream(true, this._wsPool));
    return this.setupProxy();
  }

  static get IS_WEB() {
    return true;
  }

  private _relays: { [pubkey: string]: () => void } = {};

  get relays(): string[] {
    return Object.keys(this._relays);
  }

  public async addRelay(pubkey: string): Promise<boolean> {
    let entry: errTuple = await registryRead(
      stringToUint8ArrayUtf8(pubkey),
      hashDataKey(REGISTRY_DHT_KEY)
    );

    if (entry[1] || !entry[0]?.exists) {
      return false;
    }

    const host = Buffer.from(entry[0].entryData).toString("utf8") as string;
    const [ip, port] = host.split(".");
    if (!IP_REGEX.test(ip)) {
      return false;
    }

    if (isNaN(parseInt(port))) {
      return false;
    }

    const connection = `ws://${ip}:${port}/`;

    if (!(await this.isServerAvailable(connection))) {
      return false;
    }

    this._relays[pubkey] = this._wsPool.add(connection);

    return true;
  }

  public removeRelay(pubkey: string): boolean {
    if (!(pubkey in this._relays)) {
      return false;
    }

    this._relays[pubkey]();
    delete this._relays[pubkey];

    return true;
  }

  public clearRelays(): void {
    this._wsPool.close();
    this._relays = {};
  }

  private async isServerAvailable(connection: string): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(connection);
      ws.addEventListener("open", () => {
        ws.close();
        resolve(true);
      });
      ws.addEventListener("error", () => {
        resolve(false);
      });
    });
  }

  private setupProxy() {
    return new Proxy(this, {
      get(target, name: string) {
        if (!target.hasOwnProperty(name)) {
          if (!target._dht.hasOwnProperty(name)) {
            throw new Error(`Cannot access the ${name} property`);
          }
          return target._dht[target];
        } else {
          // @ts-ignore
          return target[name];
        }
      },
      has(target, name: string) {
        if (!target.hasOwnProperty(name)) {
          return target._dht.hasOwnProperty(name);
        }

        return true;
      },
    });
  }
}

export function hashDataKey(dataKey: string): Uint8Array {
  return blake2b(encodeUtf8String(dataKey));
}

function encodeUtf8String(str: string): Uint8Array {
  const byteArray = stringToUint8ArrayUtf8(str);
  const encoded = new Uint8Array(8 + byteArray.length);
  encoded.set(encodeNumber(byteArray.length));
  encoded.set(byteArray, 8);
  return encoded;
}

function stringToUint8ArrayUtf8(str: string): Uint8Array {
  return Uint8Array.from(Buffer.from(str, "utf-8"));
}

function encodeNumber(num: number): Uint8Array {
  const encoded = new Uint8Array(8);
  for (let index = 0; index < encoded.length; index++) {
    encoded[index] = num & 0xff;
    num = num >> 8;
  }
  return encoded;
}
