const Joi = require('joi');

/* ============================================================
 * 🟦 1. VALIDACIÓN DE IMPRESIÓN (solo impresora y copias)
 * ============================================================ */
const printSchema = Joi.object({
  printerName: Joi.string().min(1).max(200).required().messages({
    'string.empty': 'El nombre de la impresora es requerido',
    'any.required': 'El nombre de la impresora es requerido'
  }),

  copies: Joi.number().integer().min(1).max(50).default(1).messages({
    'number.base': 'Las copias deben ser un número',
    'number.integer': 'Las copias deben ser un número entero',
    'number.min': 'Debe haber al menos 1 copia',
    'number.max': 'No se pueden imprimir más de 50 copias'
  })
});


const validatePDF = (req, res, next) => {
  const schema = Joi.object({
    download: Joi.boolean().default(true)
  });

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path[0],
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: "Datos de entrada inválidos",
      details: errorDetails,
      code: "VALIDATION_ERROR"
    });
  }

  req.validatedData = value;
  next();
};


const validatePrint = (req, res, next) => {
  const { printerName } = req.body;

  if (!printerName) {
    return res.status(400).json({
      success: false,
      error: "Debe enviar printerName"
    });
  }

  next();
};


/* ============================================================
 * 🟦 2. VALIDACIÓN GENERACIÓN DE PDF (AÚN REQUIERE packlistId)
 * ============================================================ */
const packlistSchema = Joi.object({
  packlistId: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string().min(1).max(50)
  ).required(),

  download: Joi.boolean().default(true)
});

const validatePacklist = (req, res, next) => {
  const { error, value } = packlistSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path[0],
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos',
      details: errorDetails
    });
  }

  req.validatedData = value;
  next();
};


/* ============================================================
 * 🟦 3. VALIDACIÓN PREVIEW
 * ============================================================ */
const previewSchema = Joi.object({
  packlistId: Joi.alternatives().try(
    Joi.number().integer().positive(),
    Joi.string().min(1).max(50)
  ).required()
});

const validatePreview = (req, res, next) => {
  const { error, value } = previewSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path[0],
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos',
      details: errorDetails
    });
  }

  req.validatedData = value;
  next();
};


/* ============================================================
 * 🟦 4. VALIDACIÓN DE PARAMS PARA URL
 * ============================================================ */
const validateParams = (req, res, next) => {
  const paramsSchema = Joi.object({
    packlistId: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().min(1).max(50)
    ).required()
  });

  const { error } = paramsSchema.validate(req.params);

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Parámetro de URL inválido',
      details: error.details[0].message
    });
  }

  next();
};


/* ============================================================
 * 🟦 5. VALIDACIÓN DE ARCHIVO PARA SERVIR PDFs
 * ============================================================ */
const validateFileParam = (req, res, next) => {
  const { fileName } = req.params;

  const valid = /^[A-Za-z0-9._-]+$/.test(fileName);

  if (!valid) {
    return res.status(400).json({
      error: "Nombre de archivo inválido",
      detail: "Solo se permiten letras, números, guiones y puntos"
    });
  }

  next();
};


module.exports = {
  validatePDF,
  validatePrint,
  validatePacklist,
  validatePreview,
  validateParams,
  validateFileParam
};
