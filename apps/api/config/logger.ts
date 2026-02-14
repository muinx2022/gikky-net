import { winston } from '@strapi/logger';

export default {
  transports: [
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
          let restString = JSON.stringify(rest);
          if (restString === '{}') {
            restString = '';
          }
          return `[${timestamp}] ${level}: ${message} ${restString}`;
        })
      ),
    }),
  ],
};
