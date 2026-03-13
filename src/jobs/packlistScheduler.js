const cron = require("node-cron");
const PacklistModel = require("../models/packlistModel");
const PDFService = require("../services/pdfService");
const PrinterService = require("../services/printerService");
const logger = require("../utils/logger");
const fs = require("fs");
const path = require("path");
const DataMapper = require("../utils/dataMapper");

class PacklistScheduler {

  constructor() {
    this.isRunning = false;
    // cache temporal de procesados
    this.processedIds = new Map();
    this.cacheTTL = 1000 * 60 * 2; // 2 minutos
    // packlists actualmente en proceso
    this.processingIds = new Set();
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  start() {
    logger.info("Scheduler de packlists iniciado");
    cron.schedule("*/2 * * * *", async () => {
      logger.debug("Verificación automática de packlists");
      await this.processPendingPacklists();
    }, {
      timezone: "America/Mexico_City"
    });
    // ejecución inicial
    setTimeout(() => {
      logger.info("Ejecución inicial del scheduler");
      this.processPendingPacklists();
    }, 10000);
  }

  // limpiar cache expirado
  cleanCache() {
    const now = Date.now();
    for (const [id, time] of this.processedIds.entries()) {
      if (now - time > this.cacheTTL) {
        this.processedIds.delete(id);
      }
    }
  }
  // determinar si se debe omitir un packlist basado en cache
  shouldSkip(packlistId) {

    if (!packlistId) return false;

    const time = this.processedIds.get(packlistId);

    if (!time) return false;

    const now = Date.now();

    if (now - time > this.cacheTTL) {

      this.processedIds.delete(packlistId);

      return false;

    }

    return true;

  }

  // extraer ID de packlist desde diferentes posibles campos
  extractPacklistId(row) {

    if (!row) return null;

    if (row.IdGpoPedidos) return row.IdGpoPedidos;
    if (row.deliveryNumber) return row.deliveryNumber;
    if (row.shipmentNumber) return row.shipmentNumber;
    if (row.packlistId) return row.packlistId;
    if (row.id) return row.id;

    // intentar extraer desde JSON
    const jsonKey = Object.keys(row).find(k => k.startsWith("JSON_") || k === "Json" || k === "JSON");

    if (jsonKey) {

      try {

        const data = JSON.parse(row[jsonKey]);

        return data.IdGpoPedidos || data.deliveryNumber || null;

      } catch (e) {

        return null;

      }

    }

    return null;

  }
// TODO: agregar lógica de reintentos con backoff exponencial
  async processPendingPacklists() {
    if (this.isRunning) {
      logger.debug("Proceso ya en ejecución ");
      return;
    }
    this.isRunning = true;
    try {
      this.cleanCache();
      logger.info("Consultando packlists pendientes...");
      const allPacklists = await PacklistModel.getPendingPacklistsFromSP();
      logger.info(`Iniciando procesamiento de ${allPacklists.length} packlists`);
      logger.info(`Packlists recibidos del SP: ${allPacklists.length}`);
      if (!allPacklists || allPacklists.length === 0) {
        logger.info("No hay packlists pendientes");
        return;
      }
      logger.info(` Tengo un total de: ${allPacklists.length} packlists encontrados`);
      for (let i = 0; i < allPacklists.length; i++) {
        const row = allPacklists[i];
        logger.info(`Comenzando procesamiento de ${i + 1} de ${allPacklists.length} packlists`);
        let packlistId = this.extractPacklistId(row);
        if (!packlistId) {
          packlistId = `temp-${i}-${Date.now()}`;
          logger.warn(`Packlist sin ID detectado → ${packlistId}`);
        }
        if (this.shouldSkip(packlistId)) {
          logger.debug(`Packlist ${packlistId} omitido por cache`);
          continue;
        }
        if (this.processingIds.has(packlistId)) {
          logger.debug(`Packlist ${packlistId} ya está en proceso`);
          continue;
        }
        try {
          this.processingIds.add(packlistId);
          await this.processSinglePacklist(row, packlistId);
          this.processedIds.set(packlistId, Date.now());
        } catch (err) {
          logger.error(`Error procesando packlist ${packlistId}`, err.message);
        } finally {
          this.processingIds.delete(packlistId);
        }
        // NUEVO (muy importante)
        if (i < allPacklists.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (err) {
      logger.error("Error general en scheduler", err);
    } finally {
      this.isRunning = false;
    }
  }

  async processSinglePacklist(row, packlistId) {

    logger.info(`Procesando packlist ${packlistId}`);

    const normalizedData = DataMapper.normalizeSQLResponse(row);

    if (!normalizedData || typeof normalizedData !== "object") {
      throw new Error("Datos normalizados inválidos");
    }

    const buffer = await PDFService.generatePackList(normalizedData, true);

    if (!buffer || buffer.length === 0) {
      throw new Error("PDF generado vacío");
    }

    this.savePDF(buffer, normalizedData.IdGpoPedidos || packlistId);

    await this.sendToPrint(buffer, normalizedData.IdGpoPedidos || packlistId);

  }

  savePDF(buffer, id, shipmentNumber) {

    const dir = path.join(__dirname, "../temp/previews");

    if (!fs.existsSync(dir)) {

      fs.mkdirSync(dir, { recursive: true });

    }

    const filename = `PACKLIST-${id}-${shipmentNumber || Date.now()}.pdf`;

    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, buffer);

    logger.info(`PDF temporal guardado → ${filename}`);

  }

  async sendToPrint(buffer, id, shipmentNumber) {

    logger.info(`Enviando a impresión ${id} ${shipmentNumber ? `(Embarque: ${shipmentNumber})` : ""}`);

    const res = await PrinterService.printPDF(buffer, "B4005029");

    if (!res.success) {

      throw new Error(res.error);

    }

    logger.info(`Impresión exitosa → ${id}`);

  }

}

module.exports = () => {

  const scheduler = new PacklistScheduler();

  scheduler.start();

  return scheduler;

};
