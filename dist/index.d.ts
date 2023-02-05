import DhtNode from "@hyperswarm/dht-relay";
import Hyperswarm from "hyperswarm";
import EventEmitter from "eventemitter2";
export default class HyperswarmWeb extends EventEmitter {
    private _options;
    private _relays;
    private _activeRelay;
    private _discovery;
    private _queuedEmActions;
    private _connectionMutex;
    constructor(opts?: any);
    get activeRelay(): Hyperswarm;
    init(): Promise<void>;
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
    join(topic: Uint8Array, opts?: {}): void;
    joinPeer(publicKey: Uint8Array): void;
    leave(topic: Uint8Array): void;
    leavePeer(publicKey: Uint8Array): void;
    status(publicKey: Uint8Array): any;
    topics(): string[];
    flush(): Promise<any>;
    clear(): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map