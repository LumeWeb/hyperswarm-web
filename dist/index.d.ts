import DhtNode from "@hyperswarm/dht-relay";
export default class DHT {
    private _options;
    private _relays;
    private _activeRelays;
    private _maxConnections;
    private _inited;
    constructor(opts?: {});
    ready(): Promise<void>;
    get relays(): string[];
    addRelay(pubkey: string): Promise<boolean>;
    removeRelay(pubkey: string): boolean;
    clearRelays(): void;
    private isServerAvailable;
    connect(pubkey: string, options?: {}): Promise<DhtNode>;
    private fillConnections;
}
export declare function hashDataKey(dataKey: string): Uint8Array;
//# sourceMappingURL=index.d.ts.map