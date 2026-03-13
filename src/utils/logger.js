// logger/index.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const util = require('util');

// ==============================================
// CONFIGURACIÓN INICIAL
// ==============================================

// Crear directorio de logs si no existe
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ==============================================
// NIVELES DE LOG PERSONALIZADOS
// ==============================================

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    sql: 4,
    packlist: 5,
    print: 6,
    debug: 7,
    trace: 8  // Nuevo nivel para máximo detalle
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'blue',
    sql: 'magenta',
    packlist: 'cyan',
    print: 'gray',
    debug: 'white',
    trace: 'grey'
  }
};

// Aplicar colores
winston.addColors(customLevels.colors);

// ==============================================
// FORMATOS PERSONALIZADOS
// ==============================================

// Formato para consola (desarrollo)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
    // Iconos para mejor visualización
    const icons = {
      error: '',
      warn: '',
      info: '',
      http: '',
      sql: '',
      packlist: '',
      print: '',
      debug: '',
      trace: ''
    };

    const icon = icons[level] || '•';

    // Colores para niveles (sin dependencia de colorize)
    const levelColors = {
      error: '\x1b[31m', // Rojo
      warn: '\x1b[33m',  // Amarillo
      info: '\x1b[32m',  // Verde
      http: '\x1b[34m',  // Azul
      sql: '\x1b[35m',   // Magenta
      packlist: '\x1b[36m', // Cian
      print: '\x1b[90m', // Gris
      debug: '\x1b[37m', // Blanco
      trace: '\x1b[90m'  // Gris claro
    };

    const color = levelColors[level] || '\x1b[0m';
    const reset = '\x1b[0m';

    let logMessage = `${color}${icon} [${timestamp}] [${level.toUpperCase()}]${reset}`;

    // Servicio
    if (service) {
      logMessage += ` ${color}[${service}]${reset}`;
    }

    logMessage += ` ${message}`;

    // Metadatos importantes para desarrollo
    const importantMetadata = {};
    if (metadata) {
      // Filtramos solo los metadatos relevantes para desarrollo
      const devKeys = ['durationMs', 'count', 'packlistId', 'deliveryNumber',
        'printer', 'jobId', 'userId', 'status', 'rows', 'error'];

      Object.keys(metadata).forEach(key => {
        if (devKeys.includes(key) || key.includes('Error') || key.includes('error')) {
          importantMetadata[key] = metadata[key];
        }
      });

      if (Object.keys(importantMetadata).length > 0) {
        logMessage += ` ${color}{${reset}`;
        logMessage += Object.entries(importantMetadata)
          .map(([k, v]) => {
            let value = v;
            if (typeof v === 'string' && v.length > 50) {
              value = v.substring(0, 47) + '...';
            }
            if (k === 'durationMs') {
              return `${color}${k}=${value}ms${reset}`;
            }
            if (k === 'error' && v instanceof Error) {
              return `${color}${k}="${v.message}"${reset}`;
            }
            return `${color}${k}="${value}"${reset}`;
          })
          .join(', ');
        logMessage += `${color}}${reset}`;
      }
    }

    return logMessage;
  })
);

// Formato para archivos (JSON estructurado)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] }),
  winston.format.json()
);

// Formato para trace (máximo detalle)
const traceFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    const metaStr = Object.entries(metadata)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' | ');
    return `${timestamp} [TRACE] ${message} | ${metaStr}`;
  })
);

// ==============================================
// TRANSPORTES CONFIGURADOS
// ==============================================

const transports = [
  // Consola - siempre activa en desarrollo
  new winston.transports.Console({
    format: consoleFormat,
    level: 'trace',
    handleExceptions: true,
    handleRejections: true
  }),

  // Archivo de trace (solo desarrollo)
  new DailyRotateFile({
    filename: path.join(logDir, 'trace-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: traceFormat,
    level: 'trace',
    maxSize: '20m',
    maxFiles: '7d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'trace.log'
  }),

  // Archivo general estructurado
  new DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    level: 'debug',
    maxSize: '10m',
    maxFiles: '30d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'app.log'
  }),

  // Archivo de errores
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    level: 'warn', // Incluye warn y error
    maxSize: '5m',
    maxFiles: '90d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'error.log'
  }),

  // Archivo específico para packlists
  new DailyRotateFile({
    filename: path.join(logDir, 'packlists-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    level: 'packlist',
    maxSize: '10m',
    maxFiles: '30d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'packlists.log'
  }),

  // Archivo para SQL queries
  new DailyRotateFile({
    filename: path.join(logDir, 'sql-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    level: 'sql',
    maxSize: '10m',
    maxFiles: '30d',
    zippedArchive: true,
    createSymlink: true,
    symlinkName: 'sql.log'
  })
];

// ==============================================
// CREACIÓN DEL LOGGER PRINCIPAL
// ==============================================

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'trace',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] })
  ),
  transports: transports,
  defaultMeta: {
    service: 'packlist-system',
    env: process.env.NODE_ENV || 'development',
    pid: process.pid
  },
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true
});

// ==============================================
// MÉTODOS ESPECIALIZADOS MEJORADOS
// ==============================================

/**
 * Logger para procesos de packlist con seguimiento completo
 */
logger.packlist = function (action, data = {}) {
  const actions = {
    // Búsqueda
    search_start: ' Iniciando búsqueda de packlists',
    search_found: ' Packlists encontrados',
    search_none: '  No hay packlists para procesar',

    // Procesamiento
    processing_start: ' Iniciando procesamiento',
    processing_item: ' Procesando packlist',
    processing_success: ' Packlist procesado exitosamente',
    processing_error: ' Error procesando packlist',
    processing_skip: '  Packlist omitido',

    // Estado
    status_change: ' Cambiando estado',
    printed: '  Marcado como impreso',
    failed: '  Marcado como fallido',

    // Batch
    batch_start: ' Iniciando lote',
    batch_progress: '  Progreso del lote',
    batch_complete: '  Lote completado',
    batch_error: '  Error en lote'
  };

  const message = actions[action] || action;

  // Añadir timestamp para seguimiento
  if (!data.traceId) {
    data.traceId = `packlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  this.log('packlist', message, {
    service: 'packlist-processor',
    ...data
  });
};

/**
 * Logger para operaciones de base de datos con timing
 */
logger.sql = function (action, data = {}) {
  const actions = {
    connect: ' Conectando a base de datos',
    connected: '  Conexión establecida',
    query_start: ' Ejecutando consulta',
    query_end: '  Consulta completada',
    query_slow: '  Consulta lenta',
    transaction_start: '  Iniciando transacción',
    transaction_commit: '  Transacción confirmada',
    transaction_rollback: '  Transacción revertida',
    sp_execute: '  Ejecutando stored procedure',
    sp_result: '  Resultado de stored procedure',
    error: '  Error de base de datos',
    pool_info: '  Info del pool de conexiones'
  };

  const message = actions[action] || action;

  // Calcular duración si hay startTime
  if (data.startTime) {
    data.durationMs = Date.now() - data.startTime;

    // Marcar como lenta si dura más de 1 segundo
    if (data.durationMs > 1000) {
      this.warn(`Consulta SQL lenta: ${data.durationMs}ms`, {
        service: 'sql-monitor',
        ...data
      });
    }
  }

  this.log('sql', message, {
    service: 'database',
    timestamp: new Date().toISOString(),
    ...data
  });
};

/**
 * Logger para generación de PDF
 */
logger.pdf = function (action, data = {}) {
  const actions = {
    generate_start: '  Iniciando generación de PDF',
    generate_end: '  PDF generado exitosamente',
    template_load: '  Cargando plantilla',
    data_prepare: '  Preparando datos',
    render_start: '   Renderizando PDF',
    render_end: '  Renderizado completado',
    save_start: '  Guardando PDF',
    save_end: '  PDF guardado',
    save_temp: '  Guardando temporal',
    cleanup: '  Limpiando archivos temporales',
    error: '  Error generando PDF',
    warning: '   Advertencia en PDF'
  };

  const message = actions[action] || action;

  // Añadir tamaño si está disponible
  if (data.buffer && data.buffer.length) {
    data.sizeKB = (data.buffer.length / 1024).toFixed(2);
    data.sizeMB = (data.buffer.length / (1024 * 1024)).toFixed(2);
  }

  this.log('info', message, {
    service: 'pdf-generator',
    ...data
  });
};

/**
 * Logger para operaciones de impresión
 */
logger.print = function (action, data = {}) {
  const actions = {
    start: '  Iniciando proceso de impresión',
    printer_select: 'Seleccionando impresora',
    printer_found: 'Impresora encontrada',
    printer_not_found: ' Impresora no encontrada',
    job_create: '  Creando trabajo de impresión',
    job_send: '  Enviando a impresora',
    job_sent: '  Trabajo enviado',
    job_success: '  Impresión exitosa',
    job_error: '  Error de impresión',
    queue_status: '  Estado de cola',
    retry: '  Reintentando impresión',
    abort: '  Impresión abortada'
  };

  const message = actions[action] || action;

  this.log('print', message, {
    service: 'printer-service',
    ...data
  });
};

/**
 * Logger para HTTP requests/responses
 */
logger.http = function (action, data = {}) {
  const actions = {
    request_in: '  Request recibido',
    request_out: '  Request enviado',
    response_success: ' Response exitoso',
    response_error: ' Response con error',
    response_slow: ' Response lento',
    redirect: '  Redirección',
    cache_hit: ' Cache hit',
    cache_miss: ' Cache miss'
  };

  const message = actions[action] || action;

  // Códigos de estado con colores
  if (data.statusCode) {
    if (data.statusCode >= 200 && data.statusCode < 300) {
      data.status = 'success';
    } else if (data.statusCode >= 300 && data.statusCode < 400) {
      data.status = 'redirect';
    } else if (data.statusCode >= 400 && data.statusCode < 500) {
      data.status = 'client_error';
    } else if (data.statusCode >= 500) {
      data.status = 'server_error';
    }
  }

  this.log('http', message, {
    service: 'http-client',
    ...data
  });
};

/**
 * Logger de seguimiento detallado (trace)
 */
logger.trace = function (component, action, data = {}) {
  const message = `[${component}] ${action}`;

  // Añadir stack trace si estamos en debug profundo
  if (process.env.DEBUG_TRACE === 'true') {
    const stack = new Error().stack.split('\n').slice(2, 6).join(' | ');
    data.stackTrace = stack;
  }

  this.log('trace', message, {
    service: 'trace',
    component,
    ...data
  });
};

/**
 * Logger para workflow (flujo completo)
 */
logger.workflow = function (workflowName, step, data = {}) {
  const steps = {
    start: ' INICIANDO WORKFLOW',
    step_start: '   Iniciando paso',
    step_complete: ' Paso completado',
    step_error: ' Error en paso',
    decision: ' Punto de decisión',
    branch: '  Ramificación',
    merge: ' Unificación',
    complete: ' WORKFLOW COMPLETADO',
    abort: ' WORKFLOW ABORTADO'
  };

  const message = steps[step] || step;

  // Mantener ID de workflow a través de todos los logs
  if (!data.workflowId) {
    data.workflowId = `wf_${workflowName}_${Date.now()}`;
  }

  // Registrar paso con secuencia
  data.stepSequence = data.stepSequence || 0;
  data.stepSequence++;

  this.log('info', `[${workflowName}] ${message}`, {
    service: 'workflow',
    workflow: workflowName,
    ...data
  });
};

/**
 * Helper para inspeccionar objetos en desarrollo
 */
logger.inspect = function (label, obj, options = {}) {
  if (process.env.NODE_ENV === 'production' && !options.force) return;

  const {
    depth = 4,
    showHidden = false,
    colors = true,
    compact = false
  } = options;

  const formatted = util.inspect(obj, {
    depth,
    showHidden,
    colors,
    compact,
    breakLength: 80,
    maxArrayLength: 20,
    maxStringLength: 100
  });

  this.trace('inspect', `=== ${label} ===\n${formatted}\n${'='.repeat(label.length + 8)}`, {
    type: 'object_inspection',
    size: JSON.stringify(obj).length
  });
};

/**
 * Logger para performance
 */
logger.performance = function (operation, data = {}) {
  const startTime = data.startTime || Date.now();
  const endTime = Date.now();
  const duration = endTime - startTime;

  let level = 'info';
  if (duration > 5000) level = 'error';
  else if (duration > 1000) level = 'warn';
  else if (duration > 500) level = 'info';
  else level = 'debug';

  this.log(level, `   Performance: ${operation}`, {
    service: 'performance',
    operation,
    durationMs: duration,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    ...data
  });

  return duration;
};

/**
 * Logger para memoria y recursos
 */
logger.resources = function () {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  this.debug('   Recursos del sistema', {
    service: 'resource-monitor',
    memory: {
      rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`
    },
    cpu: process.cpuUsage(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    pid: process.pid,
    ppid: process.ppid,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version
  });
};

/**
 * Logger para eventos del sistema
 */
logger.system = function (event, data = {}) {
  const events = {
    startup: ' Sistema iniciando',
    shutdown: ' Sistema apagando',
    config_load: ' Cargando configuración',
    config_error: ' Error de configuración',
    dependency_check: ' Verificando dependencias',
    dependency_missing: ' Dependencia faltante',
    health_check: ' Health check',
    cleanup: ' Limpieza del sistema',
    maintenance: ' Modo mantenimiento'
  };

  const message = events[event] || event;

  this.log('info', message, {
    service: 'system',
    event,
    timestamp: new Date().toISOString(),
    ...data
  });
};

// ==============================================
// FUNCIONES DE SEGUIMIENTO (TRACING)
// ==============================================

/**
 * Iniciar un trace para seguimiento completo
 */
logger.startTrace = function (traceName, data = {}) {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  this.trace('trace', `  Iniciando trace: ${traceName}`, {
    traceId,
    traceName,
    startTime,
    ...data
  });
  const startTime = Date.now();
  return {
    traceId,
    traceName,
    startTime: Date.now(),
    log: (action, traceData = {}) => {
      this.trace('trace', `   ↳ ${action}`, {
        traceId,
        traceName,
        parentTrace: traceName,
        ...traceData
      });
    },
    end: (resultData = {}) => {
      const duration = Date.now() - startTime;
      this.trace('trace', ` Finalizando trace: ${traceName}`, {
        traceId,
        traceName,
        durationMs: duration,
        endTime: Date.now(),
        ...resultData
      });
    },
    error: (error, errorData = {}) => {
      this.error(`💥 Error en trace: ${traceName}`, {
        traceId,
        traceName,
        error: error.message,
        stack: error.stack,
        ...errorData
      });
    }
  };
};

/**
 * Decorador para tracing automático de funciones
 */
logger.withTrace = function (functionName, fn) {
  return async function (...args) {
    const trace = logger.startTrace(functionName, { args: args.length });

    try {
      trace.log(`Ejecutando función`);
      const result = await fn(...args);
      trace.log(`Función completada exitosamente`);
      trace.end({ result: typeof result, success: true });
      return result;
    } catch (error) {
      trace.error(error, { args: args.length });
      throw error;
    }
  };
};

// ==============================================
// MANEJO GLOBAL DE ERRORES
// ==============================================

// Capturar excepciones no manejadas
process.on('uncaughtException', (error) => {
  logger.error(' UNCAUGHT EXCEPTION', {
    service: 'process',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  });

  // En desarrollo, no salir inmediatamente
  if (process.env.NODE_ENV !== 'production') {
    logger.warn('   Continuando en modo desarrollo después de excepción no manejada');
  } else {
    process.exit(1);
  }
});

// Capturar promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {

  logger.error(' UNHANDLED REJECTION', {
    service: 'process',
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      name: reason.name
    } : reason,
    promise: String(promise)
  });

});

// ==============================================
// FUNCIONES DE UTILIDAD PARA DESARROLLO
// ==============================================

/**
 * Configurar contexto para un request específico
 */
logger.withContext = function (context) {
  const childLogger = logger.child({ context });

  // Añadir métodos especializados al child logger
  ['packlist', 'sql', 'pdf', 'print', 'http', 'trace', 'workflow'].forEach(method => {
    if (logger[method]) {
      childLogger[method] = function (...args) {
        logger[method].call(logger, ...args);
      };
    }
  });

  return childLogger;
};

/**
 * Dump completo del estado actual
 */
logger.dumpState = function (label = 'STATE DUMP') {
  if (process.env.NODE_ENV !== 'production') {
    this.info(`  ${label}`, {
      service: 'state-dump',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DEBUG: process.env.DEBUG,
        LOG_LEVEL: process.env.LOG_LEVEL
      },
      process: {
        argv: process.argv.slice(2),
        execArgv: process.execArgv,
        cwd: process.cwd(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        memory: process.memoryUsage()
      },
      logger: {
        level: logger.level,
        transports: logger.transports.map(t => t.name || t.constructor.name),
        defaultMeta: logger.defaultMeta
      }
    });
  }
};

/**
 * Monitor de actividad para debugging
 */
logger.activityMonitor = function () {
  if (process.env.NODE_ENV !== 'production') {
    const activities = [];
    let lastLog = Date.now();

    return {
      record: (activity, data = {}) => {
        const now = Date.now();
        const elapsed = now - lastLog;
        activities.push({ activity, elapsed, timestamp: now, ...data });

        if (activities.length > 100) {
          logger.trace('activity', '  Resumen de actividad', {
            activities: activities.slice(-10),
            totalActivities: activities.length,
            averageElapsed: activities.reduce((sum, a) => sum + a.elapsed, 0) / activities.length,
          });
          lastLog = now;
          activities.shift();
        }
      },
      getSummary: () => activities
    };
  }

  return { record: () => { }, getSummary: () => [] };
};

// ==============================================
// INICIALIZACIÓN PARA DESARROLLO
// ==============================================

if (process.env.NODE_ENV !== 'production') {
  // Log de inicio del sistema
  logger.system('startup', {
    app: 'packlist-system',
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    pid: process.pid,
    cwd: process.cwd(),
    logLevel: logger.level,
    logDir: logDir
  });

  // Log de recursos iniciales
  logger.resources();

  // Configurar auto-dump cada 5 minutos en desarrollo
  setInterval(() => {
    if (process.env.AUTO_DUMP === 'true') {
      logger.dumpState('AUTO DUMP');
      logger.resources();
    }
  }, 5 * 60 * 1000);

  // Banner de inicio en desarrollo
  console.log('\n' + '='.repeat(60));
  console.log(' PACKLIST SYSTEM - MODO DESARROLLO');
  console.log('='.repeat(60));
  console.log(` Logs: ${logDir}`);
  console.log(` Nivel: ${logger.level}`);
  console.log(` Inicio: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');
}

// ==============================================
// EXPORTAR LOGGER
// ==============================================

module.exports = logger;
