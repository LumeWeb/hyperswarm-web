export default class DHT {
    private _dht;
    private _wsPool;
    constructor();
    static get IS_WEB(): boolean;
    private _relays;
    get relays(): string[];
    addRelay(pubkey: string): Promise<boolean>;
    removeRelay(pubkey: string): boolean;
    clearRelays(): void;
    private isServerAvailable;
    private setupProxy;
}
export declare function hashDataKey(dataKey: string): Uint8Array;
//# sourceMappingURL=index.d.ts.map