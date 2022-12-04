import winston, { format } from 'winston';

export class Logger {
  private logger: winston.Logger;
  public meta: Record<string, any>;

  constructor(meta = {}) {
    this.logger = winston.createLogger({
      level: 'info',
      format: format.combine(format.splat(), format.json()),
      defaultMeta: { service: 'auth-service' },
      transports: new winston.transports.Console({}),
    });

    this.meta = meta;
  }

  error(message: string, meta?: Record<string, any>) {
    this.logger.error(message, this.merged(meta));
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(message, this.merged(meta));
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(message, this.merged(meta));
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(message, this.merged(meta));
  }

  private merged(extra: Record<string, any> | undefined) {
    if (!extra) {
      return this.meta;
    }

    return Object.assign(this.meta, extra);
  }
}

const logger = new Logger();
export default logger;
