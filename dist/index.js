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
const REGISTRY_DHT_KEY = "lumeweb-dht-relay";
const IP_REGEX = /^(?:(?:2[0-4]\d|25[0-5]|1\d{2}|[1-9]?\d)\.){3}(?:2[0-4]\d|25[0-5]|1\d{2}|[1-9]?\d)$/;
export default class DHT {
    constructor() {
        this._relays = {};
        this._wsPool = createPool(WebSocket, createRoundRobin);
        this._dht = new DhtNode(new Stream(true, this._wsPool));
        return this.setupProxy();
    }
    static get IS_WEB() {
        return true;
    }
    get relays() {
        return Object.keys(this._relays);
    }
    async addRelay(pubkey) {
        let entry = await registryRead(stringToUint8ArrayUtf8(pubkey), hashDataKey(REGISTRY_DHT_KEY));
        if (entry[1] || !entry[0]?.exists) {
            return false;
        }
        const host = Buffer.from(entry[0].entryData).toString("utf8");
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
    removeRelay(pubkey) {
        if (!(pubkey in this._relays)) {
            return false;
        }
        this._relays[pubkey]();
        delete this._relays[pubkey];
        return true;
    }
    clearRelays() {
        this._wsPool.close();
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
    setupProxy() {
        return new Proxy(this, {
            get(target, name) {
                if (!target.hasOwnProperty(name)) {
                    if (!target._dht.hasOwnProperty(name)) {
                        throw new Error(`Cannot access the ${name} property`);
                    }
                    return target._dht[target];
                }
                else {
                    // @ts-ignore
                    return target[name];
                }
            },
            has(target, name) {
                if (!target.hasOwnProperty(name)) {
                    return target._dht.hasOwnProperty(name);
                }
                return true;
            },
        });
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
