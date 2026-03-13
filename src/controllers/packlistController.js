const PacklistModel = require('../models/packlistModel');
const PDFService = require('../services/pdfService');
const PrinterService = require('../services/printerService');
const DataMapper = require('../utils/dataMapper');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class PacklistController {

  /* =========================================================
   * 1. UTILIDADES PRIVADAS
   * ========================================================= */

  static #handleError(res, error, context) {
    logger.error(`❌ Error en ${context}:`, error);

    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
      code: error.code || "ERROR DIRECTAMENTE DEL CODIGO",
      timestamp: new Date().toISOString()
    });
  }


  /* =========================================================
   * 2. ENDPOINT: GENERAR PDF (SP sin parámetros)
   * ========================================================= */
  static async generatePDF(req, res) {
    try {
      const { download = true } = req.body ?? {};

      const pdfData = await PacklistModel.getPacklistDataFromSP();

      if (!pdfData) throw new Error("SP no regresó datos");

      console.log(" Datos que llega al PDF:", JSON.stringify(pdfData, null, 2));
      const pdfBuffer = await PDFService.generatePackList(pdfData);

      if (download) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=PACKLIST.pdf");
        return res.send(pdfBuffer);
      }

      res.json({
        success: true,
        pdfBase64: pdfBuffer.toString("base64")
      });

    } catch (err) {
      this.#handleError(res, err, "generatePDF");
    }
  }

  /* =========================================================
   * 3. ENDPOINT: GENERAR E IMPRIMIR PDF
   * ========================================================= */
  static async generateAndPrint(req, res) {
    try {
      const { printerName } = req.body;

      const pdfData = await PacklistModel.getPacklistDataFromSP();
      const pdfBuffer = await PDFService.generatePackList(pdfData);

      const result = await PrinterService.printPDF(pdfBuffer, printerName);

      res.json({
        success: true,
        message: "Documento enviado a la impresora",
        result
      });

    } catch (err) {
      this.#handleError(res, err, "generateAndPrint");
    }
  }

  /* =========================================================
   * 4. ENDPOINT: PREVIEW DEL PDF
   * ========================================================= */
  static async generatePreview(req, res) {
    try {
      // ✅ RECIBIR LOS DATOS DIRECTAMENTE del body (sin packlistId)
      const pdfData = req.body;

      // ✅ VALIDAR que vengan los datos mínimos
      if (!pdfData || !pdfData.DeliveryNumber) {
        return res.status(400).json({
          success: false,
          error: "Datos de packlist son requeridos",
          details: "El JSON debe incluir DeliveryNumber y la estructura completa",
          example: {
            "DeliveryNumber": "8975811355",
            "CarrierServices": "LOAD",
            "items": []
          }
        });
      }

      logger.info(`👀 Generando previsualización - Delivery: ${pdfData.DeliveryNumber}`);

      // ✅ PROCESAR los datos (parsear JSON anidado si es necesario)
      const processedData = this.#processSQLData(pdfData);

      // ✅ GENERAR PDF
      const pdfBuffer = await PDFService.generatePackList(processedData);

      // ✅ CREAR archivo temporal para preview
      const previewDir = path.join(__dirname, '../temp/previews');
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }

      const fileName = `preview-${pdfData.DeliveryNumber}-${Date.now()}.pdf`;
      const filePath = path.join(previewDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);

      // ✅ RETORNAR URL de previsualización
      const previewUrl = `/api/packlist/preview-file/${fileName}`;

      res.json({
        success: true,
        message: "✅ Preview generado exitosamente",
        data: {
          deliveryNumber: pdfData.DeliveryNumber,
          previewUrl: previewUrl,
          expiresIn: '1 hour',
          fileSize: pdfBuffer.length,
          itemsCount: pdfData.items?.length || 0,
          timestamp: new Date().toISOString()
        }
      });

    } catch (err) {
      this.#handleError(res, err, "generatePreview");
    }
  }

  // ✅ MÉTODO PARA PROCESAR DATOS DE SQL
  static #processSQLData(sqlData) {
    try {
      // Convertir campos que vienen como JSON string a objetos
      const processed = { ...sqlData };

      // Parsear shipFrom si viene como string JSON
      if (typeof processed.shipFrom === 'string') {
        try {
          processed.shipFrom = JSON.parse(processed.shipFrom);
        } catch (e) {
          processed.shipFrom = { Address: processed.shipFrom };
        }
      }

      // Parsear shipTo si viene como string JSON  
      if (typeof processed.shipTo === 'string') {
        try {
          processed.shipTo = JSON.parse(processed.shipTo);
        } catch (e) {
          processed.shipTo = { Address: processed.shipTo };
        }
      }

      // Parsear containersData si viene como string JSON
      if (typeof processed.containersData === 'string') {
        try {
          processed.containersData = JSON.parse(processed.containersData);
        } catch (e) {
          processed.containersData = {};
        }
      }

      return processed;

    } catch (error) {
      logger.error('Error procesando datos SQL:', error);
      return sqlData; // Retornar original si falla
    }
  }
  /* =========================================================
   * 5. ENDPOINT: STATUS DEL PACKLIST
   * ========================================================= */
  static async getStatus(req, res) {
    try {
      const { packlistId } = req.params;

      const dbData = await PacklistModel.getCompletePacklist(packlistId);

      res.json({
        success: true,
        data: {
          packlistId,
          exists: dbData?.length > 0,
          itemsCount: dbData?.length || 0,
          status: dbData?.length ? "ACTIVE" : "NOT_FOUND",
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (err) {
      this.#handleError(res, err, "getStatus");
    }
  }

  /* =========================================================
   * 6. ENDPOINT: GESTIÓN DE IMPRESORAS
   * ========================================================= */
  static async managePrinters(req, res) {
    try {
      const action = req.query.action || "list";
      const printerName = req.query.printerName || null;

      let result;

      switch (action) {
        case "list":
          result = await PrinterService.getAvailablePrinters();
          break;

        case "validate":
          result = await PrinterService.validatePrinter(printerName);
          break;

        case "test":
          result = await PrinterService.testPrinterConnection(printerName);
          break;

        case "test-page":
          result = await PrinterService.sendTestPage(printerName);
          break;

        default:
          throw new Error("Acción no válida");
      }

      res.json({
        success: result.success !== false,
        ...result,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      this.#handleError(res, err, "managePrinters");
    }
  }

  /* =========================================================
   * 7. ENDPOINT: SERVIR ARCHIVO DE PREVIEW
   * ========================================================= */
  static async servePreviewFile(req, res) {
    try {
      const filePath = path.join(__dirname, "../temp/previews", req.params.fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Archivo no encontrado" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.sendFile(filePath);

    } catch (err) {
      this.#handleError(res, err, "servePreviewFile");
    }
  }

  /* =========================================================
   * 8. HEALTH CHECK
   * ========================================================= */
  static async healthCheck(req, res) {
    try {
      let dbStatus = "UNKNOWN";

      try {
        await PacklistModel.getCompletePacklist(1);
        dbStatus = "CONNECTED";
      } catch {
        dbStatus = "DISCONNECTED";
      }

      const printers = await PrinterService.getAvailablePrinters();

      res.json({
        status: "OK",
        service: "PackList API",
        components: {
          database: dbStatus,
          printers: printers.success ? "AVAILABLE" : "ERROR",
          pdf: "READY"
        },
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      this.#handleError(res, err, "healthCheck");
    }
  }















































  // CODIGOS DE PRUEBA PARA VALIDACION DE DATOS CONECTIVIDAD E IMPRESION
  // NO MOVER LA ESTRUCUTURA DE ARRIBA POR FAVOR
  // EVITA PONER ERRORES FUTUROS EN LA CONFIGURACION

  /**
   * ENDPOINT DE PRUEBA: Generar PDF con datos de prueba (sin packlistId)
   */
  static async testGeneratePDF(req, res) {
    try {
      const { download = false } = req.body;

      logger.info('🧪 Generando PDF de prueba...');

      // Usar datos de prueba directamente
      const testData = {
        deliveryNumber: "DEL-TEST-001",
        carrierServices: "DHL Express",
        shipmentNumber: "SHIP-TEST-001",
        airwayBill: "AWB-TEST-001",
        eta: "2024-01-15",
        shipFrom: {
          address: "DHL LENOVO Nicanor No 425, Col. Del Valle, Mexico City, 03100, Mexico",
          dayPhone: "+52 (55) 1234-5678",
          eveningPhone: "",
          mobilePhone: ""
        },
        shipTo: {
          address: "Hugo Jaramillo, Poniente 140, No. 649 Col. Industrial Vallejo, Mexico City, 02300, Mexico",
          dayPhone: "+52 (55) 9876-5432",
          eveningPhone: "+52 (55) 9876-5433",
          mobilePhone: "+52 (55) 9876-5434"
        },
        items: [
          {
            deliveryNumber: "DEL-TEST-001",
            lineNumber: "1",
            itemId: "ITEM-TEST-001",
            itemDescription: "Laptop Computer Dell XPS 15",
            lpnNumber: "LPN-TEST-001",
            inventory: "INV-TEST-001",
            pc: "EA",
            quantityUOM: "1/EA",
            returnable: "No",
            packInstruction: "Handle with care - Fragile"
          },
          {
            deliveryNumber: "DEL-TEST-001",
            lineNumber: "2",
            itemId: "ITEM-TEST-002",
            itemDescription: "Wireless Mouse Logitech MX Master 3",
            lpnNumber: "LPN-TEST-002",
            inventory: "INV-TEST-002",
            pc: "EA",
            quantityUOM: "2/EA",
            returnable: "Yes",
            packInstruction: "Standard packing"
          }
        ]
      };

      const pdfBuffer = await PDFService.generatePackList(testData);

      if (download) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=packlist-test.pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
      } else {
        res.json({
          success: true,
          message: '✅ PDF de prueba generado exitosamente',
          data: {
            pdfBase64: pdfBuffer.toString('base64'),
            fileName: 'packlist-test.pdf',
            fileSize: pdfBuffer.length,
            itemsCount: testData.items.length,
            timestamp: new Date().toISOString()
          }
        });
      }

    } catch (error) {
      this.#handleError(res, error, 'testGeneratePDF');
    }
  }

  /**
   * ENDPOINT DE PRUEBA: Generar e imprimir con datos de prueba (sin packlistId)
   */
  static async testGenerateAndPrint(req, res) {
    try {
      const { printerName, copies = 1 } = req.body;

      logger.info('🖨️  Generando e imprimiendo PDF de prueba...');

      // Usar los mismos datos de prueba
      const testData = {
        deliveryNumber: "DEL-TEST-001",
        carrierServices: "DHL Express",
        shipmentNumber: "SHIP-TEST-001",
        airwayBill: "AWB-TEST-001",
        eta: "2024-01-15",
        shipFrom: {
          address: "DHL LENOVO Nicanor No 425, Col. Del Valle, Mexico City, 03100, Mexico",
          dayPhone: "+52 (55) 1234-5678",
          eveningPhone: "",
          mobilePhone: ""
        },
        shipTo: {
          address: "Hugo Jaramillo, Poniente 140, No. 649 Col. Industrial Vallejo, Mexico City, 02300, Mexico",
          dayPhone: "+52 (55) 9876-5432",
          eveningPhone: "+52 (55) 9876-5433",
          mobilePhone: "+52 (55) 9876-5434"
        },
        items: [
          {
            deliveryNumber: "DEL-TEST-001",
            lineNumber: "1",
            itemId: "ITEM-TEST-001",
            itemDescription: "Laptop Computer Dell XPS 15",
            lpnNumber: "LPN-TEST-001",
            inventory: "INV-TEST-001",
            pc: "EA",
            quantityUOM: "1/EA",
            returnable: "No",
            packInstruction: "Handle with care - Fragile"
          },
          {
            deliveryNumber: "DEL-TEST-001",
            lineNumber: "2",
            itemId: "ITEM-TEST-002",
            itemDescription: "Wireless Mouse Logitech MX Master 3",
            lpnNumber: "LPN-TEST-002",
            inventory: "INV-TEST-002",
            pc: "EA",
            quantityUOM: "2/EA",
            returnable: "Yes",
            packInstruction: "Standard packing"
          }
        ]
      };

      const pdfBuffer = await PDFService.generatePackList(testData);
      const printResult = await PrinterService.printPDF(pdfBuffer, printerName);

      if (!printResult.success) {
        throw {
          message: printResult.error,
          code: 'PRINT_ERROR'
        };
      }

      res.json({
        success: true,
        message: '✅ PDF de prueba generado e impreso exitosamente',
        data: {
          printer: printerName || 'Por defecto',
          copies,
          printJobId: printResult.jobId,
          itemsCount: testData.items.length,
          fileSize: pdfBuffer.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      this.#handleError(res, error, 'testGenerateAndPrint');
    }
  }


  // 7. Datos de prueba (solo desarrollo)
  static async getTestData(req, res) {
    try {
      const { id = 'TEST' } = req.query;

      const data = DataMapper.getTestData(id);

      res.json({
        success: true,
        message: `Datos de prueba generados para: ${id}`,
        data
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error generando datos de prueba'
      });
    }
  }

}

module.exports = PacklistController;