const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

class PacklistModel {

  static async getPendingPacklistsFromSP() {

    try {

      logger.info("Consultando SPWC_LNV_FNC07...");

      const query = `SET NOCOUNT ON; EXEC dbo.SPWC_LNV_FNC07`;

      const result = await executeQuery(query);

      if (!Array.isArray(result)) {

        logger.warn("El SP no devolvió un array");

        return [];

      }

      logger.info(
        `${result.length} packlists recibidos del SP`,
        result.map(r => r.IdGpoPedidos || r.deliveryNumber || "sin-id")
      );

      return result;

    } catch (err) {

      logger.error("Error ejecutando SP", err);

      return [];

    }

  }

}

module.exports = PacklistModel;
