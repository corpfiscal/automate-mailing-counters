import { Printer } from '../types';

// OIDs especificos de Ricoh — otras marcas usan OIDs diferentes
export const SNMP_OIDS = {
  serial: '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
  counter: '1.3.6.1.2.1.43.10.2.1.4.1.1',
} as const;

const printers: ReadonlyArray<Printer> = [
  { name: 'Ricoh 3054', ip: '192.168.1.125' },
  { name: 'Ricoh 3555', ip: '192.168.1.98' },
];

export default printers;
