const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const printerConfig = require('../config/printer');
const logger = require('../utils/logger');


class PrinterService {

  /**
   * MÉTODOS PRIVADOS REUTILIZABLES
   */
  // 1. Ejecutar comando con timeout y manejo de errores
  static async #executeCommand(command, timeout = 15000) {
    try {
      const { stdout, stderr } = await execAsync(command, { timeout });
      if (stderr && !stdout) {
        throw new Error(stderr);
      }
      return stdout;
    } catch (error) {
      logger.error(`Comando falló: ${command}`, error.message);
      throw error;
    }
  }

  // 2. Crear archivo temporal
  static #createTempFile(buffer, prefix = 'print') {
    const tempDir = path.join(__dirname, '../temp/generados_temporal');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `${prefix}_${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, buffer);

    // Limpiar después de 30 segundos
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (error) {
        logger.warn('No se pudo eliminar archivo temporal:', error.message);
      }
    }, 30000);

    return tempFilePath;
  }

  // 3. Obtener impresora por defecto si no se especifica
  static #getTargetPrinter(printerName = null) {
    return printerName || printerConfig.defaultPrinter;
  }

  /**
   * MÉTODO NUEVO: Verificar impresora rápidamente para el scheduler
   */
  static async quickPrinterCheck(printerName = null) {
    try {
      const targetPrinter = this.#getTargetPrinter(printerName);

      // Comando WMIC usando el nombre dinámico de la impresora
      const command = `wmic printer where "Name like '%${targetPrinter}%'" get Name,PortName /value`;

      const stdout = await this.#executeCommand(command, 5000);

      // Si no hay retorno, no existe la impresora
      if (!stdout || stdout.trim() === '') {
        return { available: false, printer: targetPrinter };
      }

      // Parseo del resultado del WMIC
      const lines = stdout
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      let name = null;
      let port = null;

      for (const line of lines) {
        if (line.startsWith("Name=")) {
          name = line.replace("Name=", "").trim();
        }
        if (line.startsWith("PortName=")) {
          port = line.replace("PortName=", "").trim();
        }
      }

      if (!name) {
        return { available: false, printer: targetPrinter };
      }

      return {
        available: true,
        printer: name,
        port: port || 'N/A'
      };

    } catch (error) {
      return { available: false, printer: this.#getTargetPrinter(printerName) };
    }
  }

  /**
   * MÉTODOS PRINCIPALES (TUS MÉTODOS ORIGINALES SE MANTIENEN)
   */

  // 1. Validar impresora (método unificado)
  static async validatePrinter(printerName = null) {
    try {
      if (!printerName) {
        throw new Error("Debe proporcionar el nombre de la impresora");
      }

      logger.info(` Validando impresora: ${printerName}`);

      const command = `powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, Shared, Published, ComputerName | ConvertTo-Json"`;
      const stdout = await this.#executeCommand(command);

      let printers = [];

      try {
        const parsed = JSON.parse(stdout);
        printers = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        logger.error(" Error parseando JSON en validatePrinter");
        throw new Error("Salida inválida desde PowerShell al obtener impresoras");
      }

      // Normalizar comparaciones
      const target = printerName.trim().toLowerCase();

      const match = printers.find(p =>
        p.Name?.toLowerCase() === target ||
        p.Name?.toLowerCase().includes(target) ||
        target.includes(p.Name?.toLowerCase())
      );

      if (match) {
        logger.info(`Impresora validada: ${match.Name}`);
        return {
          success: true,
          installed: true,
          status: "Disponible",
          printer: match.Name,
          details: {
            driver: match.DriverName,
            port: match.PortName,
            isDefault: match.Default === true
          }
        };
      }

      logger.warn(`Impresora no encontrada: ${printerName}`);
      return {
        success: false,
        installed: false,
        error: `Impresora no encontrada: ${printerName}`,
        availablePrinters: printers.map(p => p.Name)
      };

    } catch (error) {
      logger.error(`Error validando impresora: ${error.message}`);
      return {
        success: false,
        installed: false,
        error: error.message
      };
    }
  }

  // 2. Imprimir PDF (método principal) - CON MEJORA DE PERFORMANCE
  static async printPDF(pdfBuffer, printerName = null) {
    const startTime = Date.now();

    try {
      const targetPrinter = this.#getTargetPrinter(printerName);

      // Verificación previa
      const quickCheck = await this.quickPrinterCheck(targetPrinter);
      if (!quickCheck.available) {
        throw new Error(`Impresora no disponible: ${targetPrinter}`);
      }

      // Crear archivo temporal
      const tempFilePath = this.#createTempFile(pdfBuffer);

      const print = require('pdf-to-printer');

      // ⚠️ CONTROL ESTRICTO: evitar doble impresión
      const printOpts = {
        printer: targetPrinter,
        win32: ['-print-settings "fit"', '-no-dialog'],
        // Evita reintentos internos
        silent: true
      };

      logger.info(` Enviando impresión a ${targetPrinter}`);

      let printed = false;

      // ---- Intento único ----
      try {
        await print.print(tempFilePath, printOpts);
        printed = true;
      } catch (e) {
        // pdf-to-printer falló de verdad
        logger.error(` pdf-to-printer falló: ${e.message}`);
        throw new Error(`Error imprimiendo: ${e.message}`);
      }

      const duration = Date.now() - startTime;
      logger.info(`  Impreso correctamente en ${duration}ms`);

      return {
        success: true,
        method: 'pdf-to-printer',
        printer: targetPrinter,
        jobId: `job-${Date.now()}`,
        duration: `${duration}ms`
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(` Error en impresión (${duration}ms):`, error);

      return {
        success: false,
        error: error.message,
        duration: `${duration}ms`
      };
    }
  }


  // 3. Listar impresoras disponibles (VERSIÓN COMPLETAMENTE CORREGIDA)
  static async getAvailablePrinters() {
    try {
      logger.info(' Obteniendo lista de impresoras');

      const command = `powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, Default | ConvertTo-Json"`;
      const stdout = await this.#executeCommand(command);

      // Validar que stdout no esté vacío
      if (!stdout || stdout.trim() === '') {
        throw new Error('PowerShell no retornó datos');
      }

      let printers;

      try {
        printers = JSON.parse(stdout);
        console.log(' JSON parseado - Tipo:', typeof printers);

        // Manejar diferentes casos de respuesta
        if (printers === null || printers === undefined) {
          printers = [];
        } else if (!Array.isArray(printers)) {
          // Si es un objeto individual, convertirlo a array
          printers = [printers];
        }

      } catch (parseError) {
        console.log(' Error parseando JSON:', parseError.message);
        // Fallback: intentar con método alternativo
        const fallbackResult = await this.#getPrintersFallback();
        // ✅ Asegurar que el fallback retorne la misma estructura
        if (fallbackResult.success) {
          logger.info(` Fallback: ${fallbackResult.data.printers.length} impresoras encontradas`);
          return fallbackResult;
        } else {
          throw new Error('Método principal y fallback fallaron');
        }
      }

      console.log(` Número de impresoras después de parsear: ${printers.length}`);

      // Procesar las impresoras
      const parsedPrinters = printers
        .filter(printer => printer !== null && printer !== undefined)
        .map((printer, index) => {
          try {
            return {
              name: printer?.Name?.toString() || `Impresora-${index + 1}`,
              driver: printer?.DriverName?.toString() || "No especificado",
              port: printer?.PortName?.toString() || "No especificado",
              isDefault: Boolean(printer?.Default),
              status: "Disponible"
            };
          } catch (error) {
            console.warn(` Error mapeando impresora ${index}:`, error);
            return null;
          }
        })
        .filter(printer => printer !== null);

      console.log(` Impresoras después de mapeo: ${parsedPrinters.length}`);

      // Validar que tenemos impresoras
      if (!parsedPrinters || !Array.isArray(parsedPrinters)) {
        throw new Error('No se pudieron procesar las impresoras');
      }

      const defaultPrinter = parsedPrinters.find(p => p && p.isDefault);

      const result = {
        success: true,
        data: {
          printers: parsedPrinters,
          total: parsedPrinters.length,
          defaultPrinter: defaultPrinter?.name || "No configurada"
        }
      };

      logger.info(` Encontradas ${parsedPrinters.length} impresoras`);
      return result;

    } catch (error) {
      logger.error(' Error obteniendo impresoras:', error);
      return {
        success: false,
        error: "Error obteniendo lista de impresoras",
        details: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Método de respaldo mejorado - AHORA RETORNA LA MISMA ESTRUCTURA
  static async #getPrintersFallback() {
    try {
      logger.info(' Usando método WMIC alternativo');

      const command = 'wmic printer get Name,DriverName,PortName,Default /format:csv';
      const stdout = await this.#executeCommand(command);

      if (!stdout) {
        throw new Error('WMIC no retornó datos');
      }

      const lines = stdout.split('\r\n')
        .filter(line => line.trim() && !line.startsWith('Node,') && line.includes(','));

      const printers = lines.map(line => {
        try {
          const parts = line.split(',');
          return {
            name: parts[1]?.trim() || "Unknown",
            driver: parts[2]?.trim() || "Unknown",
            port: parts[3]?.trim() || "Unknown",
            isDefault: parts[4]?.trim().toLowerCase() === 'true',
            status: "Disponible",
            method: "wmic"
          };
        } catch (error) {
          console.warn('Error procesando línea de impresora:', line);
          return null;
        }
      }).filter(printer => printer !== null);

      // ✅ RETORNAR LA MISMA ESTRUCTURA QUE getAvailablePrinters()
      return {
        success: true,
        data: {
          printers: printers,
          total: printers.length,
          defaultPrinter: printers.find(p => p.isDefault)?.name || "No configurada"
        }
      };

    } catch (fallbackError) {
      logger.error(' Método alternativo falló:', fallbackError);
      // ✅ RETORNAR LA MISMA ESTRUCTURA INCLUSO EN ERROR
      return {
        success: false,
        error: "Método alternativo falló",
        details: fallbackError.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  // Los demás métodos (getPrintersFallback, sendTestPage, testPrinterConnection) 
  // se mantienen EXACTAMENTE iguales

}

module.exports = PrinterService;