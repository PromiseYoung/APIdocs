require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const PrinterService = require('./src/services/printerService');
const packlistRoutes = require('./src/routes/packlistRoutes');
const startPacklistScheduler = require("./src/jobs/packlistScheduler");

const app = express();

const PORT = process.env.PORT || 4000;
const env = process.env.NODE_ENV || "production";

// scheduler global
let scheduler = null;

// =====================================================================
// ⭐ SEGURIDAD
// =====================================================================

app.use(helmet());
app.use(cors());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
}));

// =====================================================================
// ⭐ LOGGING
// =====================================================================

if (env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// =====================================================================
// ⭐ PARSEO
// =====================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =====================================================================
// ⭐ STATIC FILES
// =====================================================================

app.use(
  '/api/packlist/preview-file',
  express.static(path.join(__dirname, 'temp/previews'))
);

// =====================================================================
// ⭐ ROUTES
// =====================================================================

app.use('/api/packlist', packlistRoutes);

// =====================================================================
// ⭐ HEALTH CHECK (NO CREA SCHEDULER NUEVO)
// =====================================================================

app.get('/health', async (req, res) => {

  try {

    const printerCheck = await PrinterService.quickPrinterCheck();

    res.json({

      status: "OK",
      service: "PackList API",
      version: "2.1.0",
      env,
      timestamp: new Date().toISOString(),

      system: {
        printer: printerCheck.available ? "Disponible" : "No disponible",
        schedulerRunning: scheduler ? scheduler.isRunning : false,
        processedCache: scheduler?.processedIds?.size || 0,
        processingNow: scheduler?.processingIds?.size || 0
      }

    });

  } catch (error) {

    res.status(500).json({
      status: "ERROR",
      error: error.message
    });

  }

});

// =====================================================================
// ⭐ API INFO
// =====================================================================

app.get('/api', (req, res) => {

  res.json({
    name: "PackList API",
    version: "2.1.0",
    description: "Sistema de generación de PackList",
    endpoints: {
      generatePDF: "POST /api/packlist/pdf",
      preview: "POST /api/packlist/preview",
      print: "POST /api/packlist/print",
      printers: "GET /api/packlist/printers",
      health: "GET /health"
    }
  });

});

// =====================================================================
// ⭐ ERROR HANDLER
// =====================================================================

app.use((err, req, res, next) => {

  console.error("  Error global:", err);

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: err.message,
    timestamp: new Date().toISOString()
  });

});

// =====================================================================
// ⭐ 404
// =====================================================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });

});

// =====================================================================
// ⭐ INICIAR SERVIDOR
// =====================================================================

let server;

async function startServer() {

  try {

    server = app.listen(PORT, async () => {

      const host = `http://localhost:${PORT}`;

      console.log("\n================================================");
      console.log(" PACKLIST API INICIADA");
      console.log("================================================\n");

      console.log(`Servidor: ${host}`);
      console.log(`Ambiente: ${env}`);
      console.log(`Puerto: ${PORT}`);

      console.log("\n Verificando impresora...");

      try {

        const printerCheck = await PrinterService.getAvailablePrinters();

        console.log(`Impresora disponible: ${printerCheck.available}`);

        if (printerCheck.available) {
          console.log(`Nombre: ${printerCheck.printer}`);
        }

      } catch (err) {

        console.log("No se pudo verificar impresora:", err.message);

      }

      // =================================================================
      // ⭐ INICIAR SCHEDULER SOLO UNA VEZ
      // =================================================================

      if (!scheduler) {

        console.log("\nIniciando scheduler...");

        scheduler = startPacklistScheduler();

        console.log("Scheduler iniciado correctamente");

      }

      console.log("\nSistema listo para recibir solicitudes\n");

    });

  } catch (error) {

    console.error("Error iniciando servidor:", error);

    process.exit(1);

  }

}

// =====================================================================
// ⭐ GRACEFUL SHUTDOWN
// =====================================================================

process.on('SIGTERM', () => {

  console.log("\nSIGTERM recibido");

  if (server) {

    server.close(() => {

      console.log("Servidor detenido");

      process.exit(0);

    });

  }

});

process.on('SIGINT', () => {

  console.log("\nSIGINT recibido");

  if (server) {

    server.close(() => {

      console.log("Servidor detenido");

      process.exit(0);

    });

  }

});

// =====================================================================
// ⭐ START
// =====================================================================

startServer();

module.exports = { app, scheduler };
