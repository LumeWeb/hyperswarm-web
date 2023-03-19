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
    _discovery;
    _queuedEmActions = [];
    _connectionMutex = new Mutex();
    constructor(opts = {}) {
        super();
        opts.custodial = false;
        this._options = opts;
        this._discovery = createClient();
    }
    _relays = new Set();
    get relays() {
        return [...this._relays.values()];
    }
    _activeRelay;
    get activeRelay() {
        return this._activeRelay;
    }
    _ready = false;
    get ready() {
        return this._ready;
    }
    init() {
        return this.ensureConnection();
    }
    async connect(pubkey, options = {}) {
        if (!this._activeRelay) {
            await this.ensureConnection();
        }
        return this._activeRelay.connect(pubkey, options);
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
    onSelf(eventName, listener, options) {
        return super.on(eventName, listener, options);
    }
    addListener(eventName, listener) {
        return this.on(eventName, listener);
    }
    off(eventName, listener) {
        return this._processOrQueueAction("off", ...arguments);
    }
    offSelf(eventName, listener) {
        return super.off(eventName, listener);
    }
    removeListener(eventName, listener) {
        return this.off(eventName, listener);
    }
    emit(eventName, ...args) {
        return this._processOrQueueAction("emit", ...arguments);
    }
    emitSelf(eventName, ...args) {
        return super.emit(eventName, ...args);
    }
    once(eventName, listener) {
        return this._processOrQueueAction("once", ...arguments);
    }
    onceSelf(eventName, listener) {
        return this.once(eventName, listener);
    }
    join(topic, opts = {}) {
        return this._processOrQueueAction("join", ...arguments);
    }
    joinPeer(publicKey) {
        return this._processOrQueueAction("joinPeer", ...arguments);
    }
    leave(topic) {
        return this._processOrQueueAction("leave", ...arguments);
    }
    leavePeer(publicKey) {
        return this._processOrQueueAction("leavePeer", ...arguments);
    }
    status(publicKey) {
        return this._activeRelay?.status(publicKey);
    }
    topics() {
        return this._activeRelay?.topics();
    }
    async flush() {
        return this._activeRelay?.flush();
    }
    async clear() {
        return this._activeRelay?.clear();
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
                this._activeRelay.dht._protocol._stream.once("close", () => {
                    this._activeRelay = undefined;
                    this._ready = false;
                    this.emitSelf("close");
                });
            } while (relays.length > 0 && !this._activeRelay);
        }
        if (!this._activeRelay) {
            this._connectionMutex.release();
            throw new Error("Failed to find an available relay");
        }
        this.emitSelf("init");
        this._processQueuedActions();
        await this._activeRelay.dht.ready();
        this._connectionMutex.release();
        this._ready = true;
        this.emit("ready");
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
