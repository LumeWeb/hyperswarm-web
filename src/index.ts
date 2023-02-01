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
import EventEmitter from "eventemitter2";

export default class HyperswarmWeb extends EventEmitter {
  private _options: any;
  private _relays: Set<string> = new Set();
  private _activeRelay: Hyperswarm;
  private _discovery: PeerDiscoveryClient;
  private _queuedEmActions: [string, any][] = [];
  constructor(opts: any = {}) {
    super();
    opts.custodial = false;
    this._options = opts;
    this._discovery = createClient();
  }

  ready(): Promise<void> {
    return this.ensureConnection();
  }

  private async ensureConnection(): Promise<any> {
    const logErr = (await load()).logErr;

    if (this._activeRelay) {
      return;
    }

    const relays = this.relays;

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

      this._activeRelay.on("close", () => {
        this._activeRelay = undefined;
      });
    } while (relays.length > 0 && !this._activeRelay);

    if (!this._activeRelay) {
      throw new Error("Failed to find an available relay");
    }

    this._processQueuedActions();
    await this._activeRelay.dht.ready();
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
  async connect(pubkey: string, options = {}): Promise<DhtNode> {
    if (!this._activeRelay) {
      await this.ensureConnection();
    }

    return this._activeRelay.connect(pubkey, options);
  }

  get relays(): string[] {
    return [...this._relays.values()];
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

  removeListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    return this.off(eventName, listener);
  }
  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this._processOrQueueAction("emit", ...arguments);
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return this._processOrQueueAction("once", ...arguments);
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
