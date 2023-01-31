// @ts-ignore
import DhtNode from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import { createClient } from "@lumeweb/kernel-peer-discovery-client";
import { load } from "@lumeweb/libkernel-universal";
import randomNumber from "random-number-csprng";
import EventEmitter from "node:events";
export default class HyperswarmWeb extends EventEmitter {
    _options;
    _relays = new Set();
    _activeRelay;
    _discovery;
    constructor(opts = {}) {
        super();
        opts.custodial = false;
        this._options = opts;
        this._discovery = createClient();
    }
    ready() {
        return this.ensureConnection();
    }
    async ensureConnection() {
        const logErr = (await load()).logErr;
        if (this._activeRelay) {
            return;
        }
        const relays = this.relays;
        do {
            const index = await randomNumber(0, relays.length - 1);
            const relay = relays[index];
            let ret;
            try {
                ret = await this._discovery.discover(relay);
            }
            catch (e) {
                logErr(e);
                relays.splice(index, 1);
                continue;
            }
            ret = ret;
            const connection = `wss://${ret.host}:${ret.port}`;
            if (!(await this.isServerAvailable(connection))) {
                relays.splice(index, 1);
                continue;
            }
            this._activeRelay = new DhtNode(new Stream(true, new WebSocket(connection)), this._options);
            this._activeRelay.on("close", () => {
                this._activeRelay = undefined;
            });
        } while (relays.length > 0);
        if (!this._activeRelay) {
            throw new Error("Failed to find an available relay");
        }
        await this._activeRelay.dht.ready();
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
        if (!this._activeRelay) {
            await this.ensureConnection();
        }
        return this._activeRelay.connect(pubkey, options);
    }
    get relays() {
        return [...this._relays.values()];
    }
    async addRelay(pubkey) {
        this._relays.add(pubkey);
    }
    removeRelay(pubkey) {
        if (!this._relays.has(pubkey)) {
            return false;
        }
        this._relays.delete(pubkey);
        return true;
    }
    clearRelays() {
        this._relays.clear();
    }
    on(eventName, listener) {
        return this._activeRelay?.on(eventName, listener);
    }
    addListener(eventName, listener) {
        return this.on(eventName, listener);
    }
    off(eventName, listener) {
        return this._activeRelay?.off(eventName, listener);
    }
    removeListener(eventName, listener) {
        return this.on(eventName, listener);
    }
    emit(eventName, ...args) {
        return this._activeRelay?.emit(eventName, ...args);
    }
    once(eventName, listener) {
        return this._activeRelay?.once(eventName, listener);
    }
}
