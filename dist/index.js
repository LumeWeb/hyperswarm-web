// src/index.ts
import DhtNode from "@hyperswarm/dht-relay";
import Stream from "@hyperswarm/dht-relay/ws";
import createRoundRobin from "@derhuerst/round-robin-scheduler";
import { Buffer } from "buffer";
import { blake2b } from "libskynet";
import { registryRead } from "libkmodule";
import { unpack } from "msgpackr";
var REGISTRY_DHT_KEY = "lumeweb-dht-node";
var DHT = class {
  _wsPool;
  _options;
  _relays = {};
  constructor(opts = {}) {
    opts.custodial = true;
    this._options = opts;
    this._wsPool = createRoundRobin();
  }
  ready() {
    return Promise.resolve();
  }
  get relays() {
    return Object.keys(this._relays);
  }
  async addRelay(pubkey) {
    var _a;
    let entry = await registryRead(Uint8Array.from(Buffer.from(pubkey, "hex")), hashDataKey(REGISTRY_DHT_KEY));
    if (entry[1] || !((_a = entry[0]) == null ? void 0 : _a.exists)) {
      return false;
    }
    let host;
    try {
      host = unpack(entry[0].entryData);
    } catch (e) {
      return false;
    }
    const [domain, port] = host.split(":");
    if (isNaN(parseInt(port))) {
      return false;
    }
    const connection = `wss://${domain}:${port}/`;
    this._wsPool.add(connection);
    this._relays[pubkey] = connection;
    return true;
  }
  removeRelay(pubkey) {
    if (!(pubkey in this._relays)) {
      return false;
    }
    this._wsPool.remove(this._relays[pubkey]);
    delete this._relays[pubkey];
    return true;
  }
  clearRelays() {
    this._wsPool = createRoundRobin();
    this._relays = {};
  }
  async isServerAvailable(connection) {
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
  async connect(pubkey, options = {}) {
    const relay = await this.getAvailableRelay();
    if (!relay) {
      throw new Error("Failed to find an available relay");
    }
    const node = new DhtNode(new Stream(true, new WebSocket(relay)), this._options);
    await node.ready();
    return node.connect(pubkey, options);
  }
  async getAvailableRelay() {
    for (let i = 0; i < this._wsPool.length; i++) {
      const relay = this._wsPool.get();
      if (await this.isServerAvailable(relay)) {
        return relay;
      }
    }
    return false;
  }
};
function hashDataKey(dataKey) {
  return blake2b(encodeUtf8String(dataKey));
}
function encodeUtf8String(str) {
  const byteArray = stringToUint8ArrayUtf8(str);
  const encoded = new Uint8Array(8 + byteArray.length);
  encoded.set(encodeNumber(byteArray.length));
  encoded.set(byteArray, 8);
  return encoded;
}
function stringToUint8ArrayUtf8(str) {
  return Uint8Array.from(Buffer.from(str, "utf-8"));
}
function encodeNumber(num) {
  const encoded = new Uint8Array(8);
  for (let index = 0; index < encoded.length; index++) {
    encoded[index] = num & 255;
    num = num >> 8;
  }
  return encoded;
}
export {
  DHT as default,
  hashDataKey
};
//# sourceMappingURL=index.js.map