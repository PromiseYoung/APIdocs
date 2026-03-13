require("dotenv").config();
const { sql, connectionString } = require("../config/database");
const logger = require("../utils/logger");

async function testDBConnection() {
  logger.info("🧪 Probando conexión a SQL Server mediante msnodesqlv8...");

  sql.open(connectionString, (err, conn) => {
    if (err) {
      logger.error("❌ Error conectando a SQL Server:", err.message);
      process.exit(1);
    }

    logger.info("✅ Conexión establecida. Ejecutando consulta de prueba...");

    conn.query("SELECT @@VERSION AS version", (err, rows) => {
      if (err) {
        logger.error("❌ Error ejecutando query:", err.message);
        conn.close();
        return process.exit(1);
      }

      logger.info("📊 Versión de SQL Server detectada:");
      console.log(rows);

      conn.close();
      logger.info("🔌 Conexión cerrada correctamente.");
      process.exit(0);
    });
  });
}

testDBConnection();
