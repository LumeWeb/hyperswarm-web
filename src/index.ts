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
      const index = await randomNumber(0, relays.length - 1);
      const relay = relays[index];

      let ret;
      try {
        ret = await this._discovery.discover(relay);
      } catch (e) {
        logErr(e);
        relays.splice(index, 1);
        continue;
      }

      ret = ret as Peer;

      const connection = `wss://${ret.host}:${ret.port}`;

      if (!(await this.isServerAvailable(connection))) {
        relays.splice(index, 1);
        continue;
      }

      this._activeRelay = new DhtNode(
        new Stream(true, new WebSocket(connection)),
        this._options
      );

      this._activeRelay.on("close", () => {
        this._activeRelay = undefined;
      });
    } while (relays.length > 0);

    if (!this._activeRelay) {
      throw new Error("Failed to find an available relay");
    }

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
    return this._activeRelay?.on(eventName, listener);
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
    return this._activeRelay?.off(eventName, listener);
  }

  removeListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    return this.on(eventName, listener);
  }
  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this._activeRelay?.emit(eventName, ...args);
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return this._activeRelay?.once(eventName, listener);
  }
}
