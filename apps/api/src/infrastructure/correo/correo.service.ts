import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

import type { Environment } from '../../config/env.schema';

export type Correo = {
  para: string;
  asunto: string;
  texto: string;
  html: string;
};

/**
 * Envío por SMTP: Mailpit en local (`smtp://localhost:1026`, buzón en
 * http://localhost:8026) y el proveedor que se elija en producción.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private readonly transporte: Transporter;
  private readonly remitente: string;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.transporte = nodemailer.createTransport(config.get('SMTP_URL', { infer: true }));
    this.remitente = config.get('MAIL_FROM', { infer: true });
  }

  async enviar(correo: Correo): Promise<void> {
    await this.transporte.sendMail({
      from: this.remitente,
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    });
  }

  /**
   * Envía sin hacer esperar a quien llamó. Lo usan el registro de una invitación
   * y la recuperación de contraseña: la respuesta sale igual de rápido exista o
   * no la cuenta, y un SMTP caído no tumba la solicitud.
   */
  enviarSinEsperar(correo: Correo): void {
    this.enviar(correo).catch((error: unknown) => {
      this.logger.error(
        `No se pudo enviar «${correo.asunto}»: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
