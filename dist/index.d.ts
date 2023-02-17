import DhtNode from "@hyperswarm/dht-relay";
import Hyperswarm from "hyperswarm";
import EventEmitter from "eventemitter2";
export default class HyperswarmWeb extends EventEmitter {
    private _options;
    private _discovery;
    private _queuedEmActions;
    private _connectionMutex;
    constructor(opts?: any);
    private _relays;
    get relays(): string[];
    private _activeRelay;
    get activeRelay(): Hyperswarm;
    private _ready;
    get ready(): boolean;
    init(): Promise<void>;
    connect(pubkey: string, options?: {}): Promise<DhtNode>;
    addRelay(pubkey: string): Promise<void>;
    removeRelay(pubkey: string): boolean;
    clearRelays(): void;
    on(eventName: string | symbol, listener: (...args: any[]) => void): Hyperswarm;
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(eventName: string | symbol, listener: (...args: any[]) => void): Hyperswarm;
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    emit(eventName: string | symbol, ...args: any[]): boolean;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    join(topic: Uint8Array, opts?: {}): void;
    joinPeer(publicKey: Uint8Array): void;
    leave(topic: Uint8Array): void;
    leavePeer(publicKey: Uint8Array): void;
    status(publicKey: Uint8Array): any;
    topics(): string[];
    flush(): Promise<any>;
    clear(): Promise<any>;
    private ensureConnection;
    private isServerAvailable;
    private _processOrQueueAction;
    private _processQueuedActions;
}
//# sourceMappingURL=index.d.ts.map