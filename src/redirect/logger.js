const { loggers, format, transports } = require('winston');

const LOGGER_NAME = 'server-logger';
const logFormat = format.printf(({ level, message, timestamp }) => `${timestamp} [${level}]: ${message}`);

if (!loggers.has(LOGGER_NAME)) {
  loggers.add(LOGGER_NAME, {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: format.combine(format.colorize(), format.timestamp({ format: 'HH:mm:ss.SS' }), format.align(), logFormat),
    transports: [new transports.Console({})]
  });
}

module.exports = loggers.get(LOGGER_NAME);
