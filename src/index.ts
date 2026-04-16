import cron from 'node-cron';
import env from './config/env';
import printers from './config/printers';
import { getAllPrinters } from './services/printer.service';
import { generatePdf } from './services/pdf.service';
import { sendReportEmail, sendErrorNotification } from './services/mail.service';
import { withRetry } from './utils/retry.util';

// Flow: query impresoras -> generar PDF -> enviar por correo
const runReportPipeline = async (): Promise<void> => {
  console.log(`[${new Date().toISOString()}] Iniciando pipeline de reporte...`);

  console.log('  -> Consultando impresoras...');
  const { results, errors } = await getAllPrinters(printers);

  if (errors.length > 0) {
    console.error('  Errores detectados en consultas SNMP:');
    errors.forEach((e) => console.error(`     - ${e}`));
  }

  if (results.length === 0) {
    throw new Error(
      `Ninguna impresora respondio correctamente. Errores: ${errors.join('; ')}`
    );
  }

  console.log(`  -> Generando PDF con ${results.length} impresora(s)...`);
  const pdf = await generatePdf(results);
  console.log(`     PDF generado: ${pdf.filename}`);

  console.log('  -> Enviando correo...');
  const messageId = await sendReportEmail(pdf);
  console.log(`     Correo enviado: ${messageId}`);

  console.log(`[${new Date().toISOString()}] Pipeline completado exitosamente.`);
};

// Retry + error handling + notificacion por correo si todo falla
const executeWithErrorHandling = async (): Promise<boolean> => {
  try {
    await withRetry(runReportPipeline, env.maxRetries, env.retryDelayMs);
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[ERROR] Todos los intentos fallaron: ${err.message}`);
    console.error(err.stack);

    try {
      await sendErrorNotification(err);
      console.log('  Notificacion de error enviada a:', env.errorMailTo.join(', '));
    } catch (notificationError) {
      console.error('CRITICAL: No se pudo enviar la notificacion de error:', notificationError);
    }
    return false;
  }
};

// ── Bootstrap ─────────────────────────────────────────────────────────────
// --once:    ejecuta 1 vez y termina (exit code 0/1). Uso: npm run once
// --run-now: ejecuta inmediatamente + deja CRON activo.  Uso: npm run dev:run
// default:   solo registra CRON y espera al schedule.    Uso: npm run dev

const isOnceMode = process.argv.includes('--once');
const isRunNow = process.argv.includes('--run-now');

const printBanner = (mode: string, extra: ReadonlyArray<string> = []) => {
  console.log('='.repeat(55));
  console.log(`  Automate Mailing Counters - ${mode}`);
  extra.forEach((line) => console.log(`  ${line}`));
  console.log(`  Max retries:  ${env.maxRetries}`);
  console.log(`  Retry delay:  ${env.retryDelayMs / 1000}s`);
  console.log('='.repeat(55));
};

if (isOnceMode) {
  printBanner('Ejecucion Unica', [
    `Recipients:   ${env.mailTo.join(', ')}`,
  ]);
  console.log('');
  executeWithErrorHandling().then((success) => process.exit(success ? 0 : 1));
} else {
  if (!cron.validate(env.cronSchedule)) {
    throw new Error(`Expresion CRON invalida: "${env.cronSchedule}". Revisa CRON_SCHEDULE en tu .env`);
  }

  printBanner('CRON Activo', [
    `Schedule:     ${env.cronSchedule}`,
    `Recipients:   ${env.mailTo.join(', ')}`,
    `Error notify: ${env.errorMailTo.join(', ')}`,
  ]);

  cron.schedule(
    env.cronSchedule,
    () => { void executeWithErrorHandling(); },
    { timezone: 'America/Mexico_City' }
  );

  if (isRunNow) {
    console.log('\nFlag --run-now detectado. Ejecutando inmediatamente...\n');
    void executeWithErrorHandling();
  }
}
