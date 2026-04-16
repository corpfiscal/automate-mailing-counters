// Declarations para net-snmp (no tiene @types oficiales)
declare module 'net-snmp' {
  type SessionOptions = {
    timeout?: number;
    retries?: number;
    version?: number;
  };

  type Varbind = {
    oid: string;
    type: number;
    value: Buffer | number | string;
  };

  type Session = {
    get(
      oids: string[],
      callback: (error: Error | null, varbinds: Varbind[]) => void
    ): void;
    close(): void;
  };

  function createSession(
    target: string,
    community: string,
    options?: SessionOptions
  ): Session;
}
