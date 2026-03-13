const express = require('express');
const PacklistController = require('../controllers/packlistController');
const {
  validatePrint,
  validatePDF,
  validatePreview,
  validateParams,
  validateFileParam
} = require('../middleware/validation');
const { scheduler } = require('../../index');
const router = express.Router();

/* =========================================================
 * 🎯 GENERACIÓN DE DOCUMENTOS
 * ========================================================= */

// ✅ Generar PDF (con o sin packlistId)
router.post(
  '/pdf',
  validatePDF,
  PacklistController.generatePDF
);

// ✅ Generar e imprimir (con packlistId)  
router.post(
  '/print',
  validatePrint,
  PacklistController.generateAndPrint
);

// ✅ Generar previsualización (sin parámetros - usa SP directo)
router.post(
  '/preview',
  validatePreview,
  PacklistController.generatePreview
);

/* =========================================================
 * 🖨️ GESTIÓN DE IMPRESORAS
 * ========================================================= */

// ✅ Gestión unificada de impresoras (POST para acciones)
router.post(
  '/printers',
  PacklistController.managePrinters
);

/* =========================================================
 * 📊 INFORMACIÓN Y ESTADO
 * ========================================================= */

// ✅ Estado de packlist específico
router.get(
  '/status/:packlistId',
  validateParams,
  PacklistController.getStatus
);

// ✅ Health check del servicio
router.get(
  '/health',
  PacklistController.healthCheck
);

// ✅ Datos de prueba (opcional)
router.get(
  '/test-data',
  PacklistController.getTestData
);

/* =========================================================
 * 📁 SERVICIO DE ARCHIVOS
 * ========================================================= */

// ✅ Servir archivos de previsualización (CORREGIDO el path)
router.get(
  '/preview-file/:fileName',
  validateFileParam,
  PacklistController.servePreviewFile
);


// =========================================================
// ENDPOINT PARA EJECUCIÓN MANUAL
// =========================================================

router.get("/test-scheduler", async (req, res) => {
  try {
    await scheduler.processPendingPacklists();

    res.json({
      success: true,
      message: "Scheduler ejecutado manualmente"
    });

  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});
/* =========================================================
 * 🔵 DEVELOPMENT ROUTES
 * ========================================================= */
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️ Development routes enabled');

  router.post('/dev/test-pdf',
    (req, res) => PacklistController.testGeneratePDF(req, res)
  );

  router.post('/dev/test-print',
    (req, res) => PacklistController.testGenerateAndPrint(req, res)
  );

  router.get('/dev/test-data',
    (req, res) => PacklistController.getTestData(req, res)
  );

  router.get('/dev/data-structure', (req, res) => {
    res.json({
      description: "Expected data structure for PDF generation",
      structure: {
        deliveryNumber: "string",
        carrierServices: "string",
        shipmentNumber: "string",
        serviceLevel: "string",
        airwayBill: "string",
        eta: "string",
        shipFrom: {
          address: "string",
          dayPhone: "string",
          eveningPhone: "string",
          mobilePhone: "string"
        },
        shipTo: {
          address: "string",
          dayPhone: "string",
          eveningPhone: "string",
          mobilePhone: "string"
        },
        items: [
          {
            deliveryNumber: "string",
            lineNumber: "string",
            itemId: "string",
            itemDescription: "string",
            lpnNumber: "string",
            inventory: "string",
            pc: "string",
            quantityUOM: "string",
            returnable: "string",
            packInstruction: "string"
          }
        ]
      }
    });
  });
}

module.exports = router;
