// @ts-ignore
import DhtNode from "@hyperswarm/dht-relay";
// @ts-ignore
import Stream from "@hyperswarm/dht-relay/ws";
import { createClient } from "@lumeweb/kernel-peer-discovery-client";
import type {
  PeerDiscoveryClient,
  Peer,
} from "@lumeweb/kernel-peer-discovery-client";
import { load } from "@lumeweb/libkernel-universal";

// @ts-ignore
import Hyperswarm from "hyperswarm";
import randomNumber from "random-number-csprng";
import EventEmitter, { OnOptions } from "eventemitter2";
import { Mutex } from "async-mutex";

export default class HyperswarmWeb extends EventEmitter {
  private _options: any;
  private _discovery: PeerDiscoveryClient;
  private _queuedEmActions: [string, any][] = [];
  private _connectionMutex: Mutex = new Mutex();

  constructor(opts: any = {}) {
    super();
    opts.custodial = false;
    this._options = opts;
    this._discovery = createClient();
  }

  private _relays: Set<string> = new Set();

  get relays(): string[] {
    return [...this._relays.values()];
  }

  private _activeRelay: Hyperswarm;

  get activeRelay(): Hyperswarm {
    return this._activeRelay;
  }

  private _ready = false;

  get ready(): boolean {
    return this._ready;
  }

  init(): Promise<void> {
    return this.ensureConnection();
  }

  async connect(pubkey: string, options = {}): Promise<DhtNode> {
    if (!this._activeRelay) {
      await this.ensureConnection();
    }

    return this._activeRelay.connect(pubkey, options);
  }

  public async addRelay(pubkey: string): Promise<void> {
    this._relays.add(pubkey);
  }

  public removeRelay(pubkey: string): boolean {
    if (!this._relays.has(pubkey)) {
      return false;
    }

    this._relays.delete(pubkey);

    return true;
  }

  public clearRelays(): void {
    this._relays.clear();
  }

  on(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): Hyperswarm {
    return this._processOrQueueAction("on", ...arguments);
  }

  onSelf(
    eventName: string | symbol,
    listener: (...args: any[]) => void,
    options?: boolean | OnOptions
  ): Hyperswarm {
    return super.on(eventName, listener, options);
  }

  addListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    return this.on(eventName, listener);
  }

  off(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): Hyperswarm {
    return this._processOrQueueAction("off", ...arguments);
  }

  offSelf(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): Hyperswarm {
    return super.off(eventName, listener);
  }

  removeListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    return this.off(eventName, listener);
  }

  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this._processOrQueueAction("emit", ...arguments);
  }

  emitSelf(eventName: string | symbol, ...args: any[]): boolean {
    return super.emit(eventName, ...args);
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return this._processOrQueueAction("once", ...arguments);
  }

  onceSelf(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    return this.once(eventName, listener);
  }

  public join(topic: Uint8Array, opts = {}): void {
    return this._processOrQueueAction("join", ...arguments);
  }

  public joinPeer(publicKey: Uint8Array): void {
    return this._processOrQueueAction("joinPeer", ...arguments);
  }

  public leave(topic: Uint8Array): void {
    return this._processOrQueueAction("leave", ...arguments);
  }

  public leavePeer(publicKey: Uint8Array): void {
    return this._processOrQueueAction("leavePeer", ...arguments);
  }

  public status(publicKey: Uint8Array) {
    return this._activeRelay?.status(publicKey);
  }

  public topics(): string[] {
    return this._activeRelay?.topics();
  }

  public async flush(): Promise<any> {
    return this._activeRelay?.flush();
  }

  public async clear(): Promise<any> {
    return this._activeRelay?.clear();
  }

  private async ensureConnection(): Promise<any> {
    const logErr = (await load()).logErr;

    await this._connectionMutex.waitForUnlock();
    this._connectionMutex.acquire();

    if (this._activeRelay) {
      this._connectionMutex.release();
      return;
    }

    const relays = this.relays;

    if (relays.length > 0) {
      do {
        const index =
          relays.length > 1 ? await randomNumber(0, relays.length - 1) : 0;
        const relay = relays[index];

        let ret;
        try {
          ret = await this._discovery.discover(relay);
        } catch (e) {
          logErr(e);
          relays.splice(index, 1);
          continue;
        }

        if (!ret) {
          relays.splice(index, 1);
          continue;
        }

        ret = ret as Peer;

        const connection = `wss://${ret.host}:${ret.port}`;

        if (!(await this.isServerAvailable(connection))) {
          relays.splice(index, 1);
          continue;
        }

        this._activeRelay = new Hyperswarm({
          dht: new DhtNode(
            new Stream(true, new WebSocket(connection)),
            this._options
          ),
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

  private async isServerAvailable(connection: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
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

  private _processOrQueueAction(method: string, ...args: any[]) {
    if (this._activeRelay) {
      return this._activeRelay[method](...args);
    }

    this._queuedEmActions.push([method, args]);
    return this;
  }

  private _processQueuedActions(): void {
    for (const action of this._queuedEmActions) {
      this._activeRelay[action[0]](...action[1]);
    }

    this._queuedEmActions = [];
  }
}
