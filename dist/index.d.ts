import DhtNode from "@hyperswarm/dht-relay";
export default class DHT {
    private _wsPool;
    private _options;
    private _relays;
    constructor(opts?: {});
    ready(): Promise<void>;
    get relays(): string[];
    addRelay(pubkey: string): Promise<boolean>;
    removeRelay(pubkey: string): boolean;
    clearRelays(): void;
    private isServerAvailable;
    connect(pubkey: string, options?: {}): Promise<DhtNode>;
    getAvailableRelay(): Promise<string | boolean>;
}
export declare function hashDataKey(dataKey: string): Uint8Array;
//# sourceMappingURL=index.d.ts.map