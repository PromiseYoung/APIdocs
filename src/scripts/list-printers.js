const PrinterService = require('../services/printerService');

async function listPrinters() {
  try {
    console.log('🖨️  Listando impresoras disponibles...');
    const printers = await PrinterService.getAvailablePrinters();
    console.log('Impresoras:', printers);
  } catch (error) {
    console.error('Error:', error);
  }
}

listPrinters();