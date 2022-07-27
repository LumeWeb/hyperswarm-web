// @ts-ignore
import DhtNode from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
// @ts-ignore
import { Buffer } from "buffer";
// @ts-ignore
// @ts-ignore
import { blake2b } from "libskynet";
// @ts-ignore
import { registryRead } from "libkmodule";
import { unpack } from "msgpackr";
import randomNumber from "random-number-csprng";
const REGISTRY_DHT_KEY = "lumeweb-dht-node";
export default class DHT {
    _options;
    _relays = new Map();
    _activeRelays = new Map();
    _maxConnections = 10;
    _inited = false;
    constructor(opts = {}) {
        // @ts-ignore
        opts.custodial = false;
        this._options = opts;
    }
    ready() {
        if (this._inited) {
            return Promise.resolve();
        }
        this._inited = true;
        return this.fillConnections();
    }
    get relays() {
        return [...this._relays.keys()];
    }
    async addRelay(pubkey) {
        let entry = await registryRead(Uint8Array.from(Buffer.from(pubkey, "hex")), hashDataKey(REGISTRY_DHT_KEY));
        if (entry[1] || !entry[0]?.exists) {
            return false;
        }
        let host;
        try {
            host = unpack(entry[0].entryData);
        }
        catch (e) {
            return false;
        }
        const [domain, port] = host.split(":");
        if (isNaN(parseInt(port))) {
            return false;
        }
        this._relays.set(pubkey, `wss://${domain}:${port}/`);
        if (this._inited) {
            await this.fillConnections();
        }
        return true;
    }
    removeRelay(pubkey) {
        if (!this._relays.has(pubkey)) {
            return false;
        }
        if (this._activeRelays.has(pubkey)) {
            this._activeRelays.get(pubkey).destroy();
            this._activeRelays.delete(pubkey);
        }
        this._relays.delete(pubkey);
        return true;
    }
    clearRelays() {
        [...this._relays.keys()].forEach(this.removeRelay);
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
        if (this._activeRelays.size === 0) {
            throw new Error("Failed to find an available relay");
        }
        const node = this._activeRelays.get([...this._activeRelays.keys()][await randomNumber(0, this._activeRelays.size - 1)]);
        return node.connect(pubkey, options);
    }
    async fillConnections() {
        let available = [];
        const updateAvailable = () => {
            available = [...this._relays.keys()].filter((x) => ![...this._activeRelays.keys()].includes(x));
        };
        updateAvailable();
        let relayPromises = [];
        while (this._activeRelays.size <=
            Math.min(this._maxConnections, available.length)) {
            if (0 === available.length) {
                break;
            }
            let relayIndex = 0;
            if (available.length > 1) {
                relayIndex = await randomNumber(0, available.length - 1);
            }
            const connection = this._relays.get(available[relayIndex]);
            if (!(await this.isServerAvailable(connection))) {
                continue;
            }
            const node = new DhtNode(new Stream(true, new WebSocket(connection)), this._options);
            this._activeRelays.set(available[relayIndex], node);
            updateAvailable();
            relayPromises.push(node.ready());
        }
        return Promise.allSettled(relayPromises);
    }
}
export function hashDataKey(dataKey) {
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
        encoded[index] = num & 0xff;
        num = num >> 8;
    }
    return encoded;
}
