require('dotenv').config();

const printerConfig = {
  networkPrinter: process.env.NETWORK_PRINTER || '\\\\192.168.50.29\\b4005029',
  defaultPrinter: process.env.DEFAULT_PRINTER || 'b4005029',
  paperSize: process.env.PAPER_SIZE || 'A4',
  orientation: process.env.ORIENTATION || 'portrait',
  copies: parseInt(process.env.COPIES) || 1,
  timeout: parseInt(process.env.PRINT_TIMEOUT) || 30000
};

module.exports = printerConfig;