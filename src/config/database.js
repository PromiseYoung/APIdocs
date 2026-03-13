const sql = require("msnodesqlv8");

// Determinar entorno
const env = process.env.NODE_ENV || "production";

// Seleccionar configuración según entorno
const getConfig = () => {
  if (env === "development") {
    console.log(` Conectando a BD DESARROLLO: ${process.env.DB_DEV_SERVER}/${process.env.DB_DEV_NAME}`);
    return {
      server: process.env.DB_DEV_SERVER || "192.168.1.253,47600\\A2",
      database: process.env.DB_DEV_NAME || "BD_LNV_PRO_WL_CAL",
      user: process.env.DB_DEV_USER || "sa",
      password: process.env.DB_DEV_PASSWORD || "20Wals2020"
    };
  } else {
    console.log(` Conectando a BD PRODUCCIÓN: ${process.env.DB_PROD_SERVER}/${process.env.DB_PROD_NAME}`);
    return {
      server: process.env.DB_PROD_SERVER || "192.168.1.253,47600\\A2",
      database: process.env.DB_PROD_NAME || "BD_LNV_PRO_WL",
      user: process.env.DB_PROD_USER || "sa",
      password: process.env.DB_PROD_PASSWORD || "20Wals2020"
    };
  }
};

const config = getConfig();

const connectionString = `
Server=${config.server};
Database=${config.database};
UID=${config.user};
PWD=${config.password};
Trusted_Connection=Yes;
Driver={SQL Server};
`;

console.log(` Configuración BD cargada para entorno: ${env.toUpperCase()}`);

function executeQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    sql.query(connectionString, query, params, (err, rows) => {
      if (err) {
        console.error(` Error en consulta BD (${env}):`, err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

// Función para probar la conexión
async function testConnection() {
  try {
    console.log(`  Probando conexión a BD ${env}...`);
    const result = await executeQuery("SELECT @@VERSION as version");
    console.log(`  Conexión a BD ${env} exitosa`);
    return { success: true, environment: env, server: config.server };
  } catch (error) {
    console.error(`  Error conectando a BD ${env}:`, error.message);
    return { success: false, environment: env, error: error.message };
  }
}

module.exports = {
  sql,
  connectionString,
  executeQuery,
  testConnection,
  currentEnv: env,
  dbConfig: config
};