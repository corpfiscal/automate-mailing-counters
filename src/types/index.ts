export type Printer = {
  readonly name: string;
  readonly ip: string;
};

export type PrinterResult = {
  readonly printer: string;
  readonly ip: string;
  readonly serial: string;
  readonly counter: number;
};

// Patron "Result + Errors" para manejar partial failures sin excepciones
export type PrinterQueryResponse = {
  readonly results: ReadonlyArray<PrinterResult>;
  readonly errors: ReadonlyArray<string>;
};

export type EnvConfig = {
  readonly snmpCommunity: string;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpSecure: boolean;
  readonly smtpUser: string;
  readonly smtpPass: string;
  readonly mailFrom: string;
  readonly mailTo: ReadonlyArray<string>;
  readonly cronSchedule: string;
  readonly errorMailTo: ReadonlyArray<string>;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
};
