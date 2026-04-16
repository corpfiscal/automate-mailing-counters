import snmp from 'net-snmp';
import env from '../config/env';
import { SNMP_OIDS } from '../config/printers';
import { Printer, PrinterResult, PrinterQueryResponse } from '../types';

// Adapter: wrappea el callback de net-snmp en una Promise
const queryPrinter = (printer: Printer): Promise<PrinterResult> =>
  new Promise((resolve, reject) => {
    const session = snmp.createSession(printer.ip, env.snmpCommunity, {
      timeout: 5000,
    });

    const oids = Object.values(SNMP_OIDS);

    session.get([...oids], (error: Error | null, varbinds: snmp.Varbind[]) => {
      session.close();

      if (error) {
        return reject(
          new Error(`Error en ${printer.name} (${printer.ip}): ${error.message}`)
        );
      }

      resolve({
        printer: printer.name,
        ip: printer.ip,
        serial: varbinds[0].value.toString(),
        counter: parseInt(String(varbinds[1].value), 10),
      });
    });
  });

// Consultas en paralelo — un fallo en una impresora NO bloquea las demas
export const getAllPrinters = async (
  printers: ReadonlyArray<Printer>
): Promise<PrinterQueryResponse> => {
  const settlements = await Promise.allSettled(printers.map(queryPrinter));

  return settlements.reduce<PrinterQueryResponse>(
    (acc, settlement) => {
      if (settlement.status === 'fulfilled') {
        return { ...acc, results: [...acc.results, settlement.value] };
      }
      const message =
        settlement.reason instanceof Error
          ? settlement.reason.message
          : String(settlement.reason);
      return { ...acc, errors: [...acc.errors, message] };
    },
    { results: [], errors: [] }
  );
};
