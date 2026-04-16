import nodemailer, { Transporter } from 'nodemailer';
import env from '../config/env';

const createTransporter = (): Transporter =>
  nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

export const sendReportEmail = async (
  pdf: { buffer: Buffer; filename: string }
): Promise<string> => {
  const transporter = createTransporter();
  const today = new Date().toLocaleDateString('es-MX');

  const info = await transporter.sendMail({
    from: env.mailFrom,
    to: env.mailTo.join(', '),
    subject: `Lectura de contadores - ${today}`,
    text: [
      'Buen dia,',
      '',
      `Adjunto el reporte de contadores correspondiente a la fecha ${today}.`,
      '',
      'Saludos.',
    ].join('\n'),
    attachments: [
      {
        filename: pdf.filename,
        content: pdf.buffer,
      },
    ],
  });

  return info.messageId;
};

// Envia detalles del error a ERROR_MAIL_TO (equipo de soporte, no los recipients del reporte)
export const sendErrorNotification = async (error: Error): Promise<void> => {
  const transporter = createTransporter();
  const timestamp = new Date().toLocaleString('es-MX');

  await transporter.sendMail({
    from: env.mailFrom,
    to: env.errorMailTo.join(', '),
    subject: `[ERROR] Reporte de contadores - ${timestamp}`,
    text: [
      'Se detecto un error durante la ejecucion del reporte de contadores.',
      '',
      `Timestamp: ${timestamp}`,
      `Error: ${error.message}`,
      '',
      'Stack Trace:',
      error.stack ?? 'No disponible',
      '',
      'Este es un mensaje automatico. Revisa los logs del servidor para mas detalles.',
    ].join('\n'),
  });
};
