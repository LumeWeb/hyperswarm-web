// @ts-ignore
import DhtNode from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import { createClient } from "@lumeweb/kernel-peer-discovery-client";
import { load } from "@lumeweb/libkernel-universal";
// @ts-ignore
import Hyperswarm from "hyperswarm";
import randomNumber from "random-number-csprng";
import EventEmitter from "eventemitter2";
import { Mutex } from "async-mutex";
export default class HyperswarmWeb extends EventEmitter {
    _options;
    _relays = new Set();
    _activeRelay;
    _discovery;
    _queuedEmActions = [];
    _connectionMutex = new Mutex();
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
        await this._connectionMutex.waitForUnlock();
        this._connectionMutex.acquire();
        if (this._activeRelay) {
            return;
        }
        const relays = this.relays;
        if (relays.length > 0) {
            do {
                const index = relays.length > 1 ? await randomNumber(0, relays.length - 1) : 0;
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
                if (!ret) {
                    relays.splice(index, 1);
                    continue;
                }
                ret = ret;
                const connection = `wss://${ret.host}:${ret.port}`;
                if (!(await this.isServerAvailable(connection))) {
                    relays.splice(index, 1);
                    continue;
                }
                this._activeRelay = new Hyperswarm({
                    dht: new DhtNode(new Stream(true, new WebSocket(connection)), this._options),
                    keyPair: this._options.keyPair,
                });
                this._activeRelay.on("close", () => {
                    this._activeRelay = undefined;
                });
            } while (relays.length > 0 && !this._activeRelay);
        }
        if (!this._activeRelay) {
            this._connectionMutex.release();
            throw new Error("Failed to find an available relay");
        }
        this._processQueuedActions();
        await this._activeRelay.dht.ready();
        this._connectionMutex.release();
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
        return this._processOrQueueAction("on", ...arguments);
    }
    addListener(eventName, listener) {
        return this.on(eventName, listener);
    }
    off(eventName, listener) {
        return this._processOrQueueAction("off", ...arguments);
    }
    removeListener(eventName, listener) {
        return this.off(eventName, listener);
    }
    emit(eventName, ...args) {
        return this._processOrQueueAction("emit", ...arguments);
    }
    once(eventName, listener) {
        return this._processOrQueueAction("once", ...arguments);
    }
    _processOrQueueAction(method, ...args) {
        if (this._activeRelay) {
            return this._activeRelay[method](...args);
        }
        this._queuedEmActions.push([method, args]);
        return this;
    }
    _processQueuedActions() {
        for (const action of this._queuedEmActions) {
            this._activeRelay[action[0]](...action[1]);
        }
        this._queuedEmActions = [];
    }
}
