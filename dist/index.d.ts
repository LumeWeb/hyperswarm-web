import DhtNode from "@hyperswarm/dht-relay";
import Hyperswarm from "hyperswarm";
import EventEmitter from "eventemitter2";
export default class HyperswarmWeb extends EventEmitter {
    private _options;
    private _relays;
    private _activeRelay;
    private _discovery;
    private _queuedEmActions;
    constructor(opts?: any);
    ready(): Promise<void>;
    private ensureConnection;
    private isServerAvailable;
    connect(pubkey: string, options?: {}): Promise<DhtNode>;
    get relays(): string[];
    addRelay(pubkey: string): Promise<void>;
    removeRelay(pubkey: string): boolean;
    clearRelays(): void;
    on(eventName: string | symbol, listener: (...args: any[]) => void): Hyperswarm;
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(eventName: string | symbol, listener: (...args: any[]) => void): Hyperswarm;
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    emit(eventName: string | symbol, ...args: any[]): boolean;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    private _processOrQueueAction;
    private _processQueuedActions;
}
//# sourceMappingURL=index.d.ts.map