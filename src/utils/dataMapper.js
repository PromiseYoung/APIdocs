class DataMapper {

  static safeParse(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') return null;

    try {
      // CASO 1: JSON normal - intentar parsear directamente
      return JSON.parse(jsonString);
    } catch (error1) {
      console.log('Intento 1 falló, intentando limpieza...');

      try {
        // CASO 2: JSON con escapes dobles (como tu ejemplo)
        // Reemplazar \\\" por "
        let clean1 = jsonString.replace(/\\\\"/g, '"');

        // Reemplazar \" por "
        clean1 = clean1.replace(/\\"/g, '"');

        // Quitar comillas externas de objetos/arrays anidados
        clean1 = clean1.replace(/"\{/g, '{')
          .replace(/\}"/g, '}')
          .replace(/":\s*"\[/g, '": [')
          .replace(/\]"\s*,/g, '],');

        return JSON.parse(clean1);
      } catch (error2) {
        console.log('Intento 2 falló, intentando solución agresiva...');

        try {
          // CASO 3: Para el formato exacto de tu ejemplo
          // Buscar y reparar objetos JSON anidados como strings
          let clean2 = jsonString;

          // Patrón para encontrar objetos JSON anidados como strings
          const nestedObjectPattern = /"(\{[^}]+\})"/g;
          clean2 = clean2.replace(nestedObjectPattern, '$1');

          // Patrón para arrays anidados como strings
          const nestedArrayPattern = /"(\[[^\]]+\])"/g;
          clean2 = clean2.replace(nestedArrayPattern, '$1');

          // Limpiar escapes restantes
          clean2 = clean2.replace(/\\\\"/g, '"')
            .replace(/\\"/g, '"');

          return JSON.parse(clean2);
        } catch (error3) {
          console.log('Intento 3 falló, último intento...');

          try {
            // CASO 4: Usar eval como último recurso (CUIDADO)
            // Solo si confías en el origen de los datos
            const sanitized = jsonString
              .replace(/\\\\"/g, '"')
              .replace(/\\"/g, '"');

            // Evaluar como JavaScript (último recurso)
            try {
              return JSON.parse(sanitized);
            } catch {
              return null;
            }
          } catch (error4) {
            console.log('Todos los intentos fallaron:', error4.message);
            console.log('String original:', jsonString.substring(0, 500));
            return null;
          }
        }
      }
    }
  }

  // PARSEO DE JSON DE NUEVAS MODIFICACIONES
  static fixNestedJsonStrings(jsonString) {
    // Función específica para reparar el formato que muestras
    let fixed = jsonString;

    // 1. Eliminar escapes dobles
    fixed = fixed.replace(/\\\\"/g, '"');

    // 2. Reemplazar \" por "
    fixed = fixed.replace(/\\"/g, '"');

    // 3. Encontrar y reparar objetos JSON anidados como strings
    // Ejemplo: "{\"Address\":\"...\"}" -> {"Address":"..."}
    const objectPattern = /"(\{[^"{}]*(?:\{[^"{}]*\}[^"{}]*)*\})"/g;
    fixed = fixed.replace(objectPattern, (match, p1) => {
      return p1.replace(/\\"/g, '"');
    });

    // 4. Reparar arrays anidados
    const arrayPattern = /"(\[[^"\]]*(?:\[[^"\]]*\][^"\]]*)*\])"/g;
    fixed = fixed.replace(arrayPattern, (match, p1) => {
      return p1.replace(/\\"/g, '"');
    });

    console.log(' JSON reparado:', fixed.substring(0, 300) + '...');
    return fixed;
  }



  static normalizeSQLResponse(row) {
    if (!row || typeof row !== "object") return row;

    console.log('\n DATOS RECIBIDOS DEL PROCEDIMIENTO ALMACENADO:', JSON.stringify(row, null, 2));


    // ✅ FUNCIÓN AUXILIAR PARA ENCONTRAR EL JSON
    const findJsonProperty = (obj) => {
      // Prioridad 1: Buscar propiedad que empiece con "JSON_"
      for (const key in obj) {
        if (key.startsWith('JSON_') && typeof obj[key] === 'string') {
          console.log(`\n JSON encontrado en propiedad: ${key}`);
          return obj[key];
        }
      }

      // Prioridad 2: Buscar propiedad "Json" o "JSON"
      if (obj.Json && typeof obj.Json === 'string') {
        console.log('\n JSON encontrado en propiedad: Json');
        return obj.Json;
      }

      if (obj.JSON && typeof obj.JSON === 'string') {
        console.log('\n JSON encontrado en propiedad: JSON');
        return obj.JSON;
      }

      // Prioridad 3: Buscar cualquier string que parezca JSON
      for (const key in obj) {
        if (typeof obj[key] === 'string' &&
          (obj[key].trim().startsWith('{') || obj[key].trim().startsWith('['))) {
          console.log(` JSON encontrado en propiedad: ${key}`);
          return obj[key];
        }
      }

      return null;
    };

    // ✅ ENCONTRAR EL JSON
    const jsonString = findJsonProperty(row);

    if (!jsonString) {
      console.log('No se encontró propiedad JSON en la respuesta');
      console.log('Propiedades disponibles:', Object.keys(row));
      return this.#getEmptyStructure();
    }

    console.log('\n JSON ENCONTRADO (primeros 300 chars):', jsonString.substring(0, 300) + '...');

    // ✅ FUNCIÓN MEJORADA PARA PARSEAR JSON CON PROBLEMAS
    const safeParse = (str) => {
      if (!str || typeof str !== 'string') return null;

      try {
        // Intento 1: Parsear directamente
        return JSON.parse(str);
      } catch (error1) {
        console.log('Intento 1 falló, limpiando JSON...');

        try {
          // Intento 2: Limpiar escapes dobles (para tu caso específico)
          let clean = str;

          // Reemplazar \\\" por "
          clean = clean.replace(/\\\\"/g, '"');

          // Reemplazar \" por "
          clean = clean.replace(/\\"/g, '"');

          // Reparar objetos JSON anidados que están como strings
          // Ejemplo: "{\"Address\":\"...\"}" -> {"Address":"..."}
          clean = clean.replace(/"(\{[^}]*\})"/g, '$1');

          // Reparar arrays anidados
          clean = clean.replace(/"(\[[^\]]*\])"/g, '$1');

          return JSON.parse(clean);
        } catch (error2) {
          console.log('Intento 2 falló, intentando método agresivo...');

          try {
            // Intento 3: Método más agresivo para JSON muy dañado
            let fixed = str;

            // Eliminar todos los escapes
            fixed = fixed.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

            // Buscar y reparar objetos anidados manualmente
            const nestedObjectRegex = /"(\s*\{[^}]*\}\s*)"/g;
            fixed = fixed.replace(nestedObjectRegex, (match, p1) => {
              return p1.trim();
            });

            return JSON.parse(fixed);
          } catch (error3) {
            console.log('Todos los intentos fallaron:', error3.message);
            return null;
          }
        }
      }
    };

    // Parsear el JSON
    const jsonData = safeParse(jsonString);

    if (!jsonData) {
      console.log('No se pudo parsear el JSON de la propiedad');
      return this.#getEmptyStructure();
    }

    console.log(' JSON PARSEADO EXITOSAMENTE');
    console.log('Estructura del JSON:', Object.keys(jsonData));


    const normalized = {};

    // =====================================================
    // MAPEO DIRECTO DEL JSON PARSEADO (TU CÓDIGO ORIGINAL)
    // =====================================================
    normalized.priorityName = jsonData.PriorityName || jsonData.priorityName || "";
    normalized.IdGpoPedidos = jsonData.IdGpoPedidos || jsonData.idGpoPedidos || "";
    normalized.carrierServices = jsonData.CarrierServices || jsonData.carrierServices || "";
    normalized.serviceLevel = jsonData.ServiceLevel || jsonData.serviceLevel || "";
    normalized.shipmentNumber = jsonData.ShipmentNumber || jsonData.shipmentNumber || "";
    normalized.InternalCode = jsonData.InternalCode || jsonData.internalCode || "";
    normalized.Customer = jsonData.Customer || jsonData.customer || "";
    normalized.eta = jsonData.ETA || jsonData.eta || "";

    // =====================================================
    // SHIP FROM - Parsear si viene como string JSON
    // =====================================================
    console.log('shipFrom crudo:', jsonData.shipFrom || jsonData.shipFrom);
    console.log('Tipo de shipFrom:', typeof (jsonData.shipFrom || jsonData.shipFrom));

    let shipFromParsed = jsonData.shipFrom;
    if (typeof jsonData.shipFrom === "string") {
      shipFromParsed = safeParse(jsonData.shipFrom);
      console.log('shipFrom parseado:', shipFromParsed);
    }

    normalized.shipFrom = {
      contactName: shipFromParsed?.ContactName || shipFromParsed?.contactName || "",
      address: shipFromParsed?.Address || shipFromParsed?.address || "",
      dayPhone: shipFromParsed?.DayPhone || shipFromParsed?.dayPhone || "",
      eveningPhone: shipFromParsed?.EveningPhone || shipFromParsed?.eveningPhone || "",
      mobilePhone: shipFromParsed?.MobilePhone || shipFromParsed?.mobilePhone || ""
    };

    // =====================================================
    // 3️⃣ SHIP TO - Parsear si viene como string JSON
    // =====================================================
    console.log('shipTo crudo:', jsonData.shipTo);
    console.log('Tipo de shipTo:', typeof jsonData.shipTo);

    let shipToParsed = jsonData.shipTo;
    if (typeof jsonData.shipTo === "string") {
      shipToParsed = safeParse(jsonData.shipTo);
      console.log('shipTo parseado:', shipToParsed);
    }

    normalized.shipTo = {
      contactName: shipToParsed?.contactName || shipToParsed?.Contactname || "",
      address: shipToParsed?.Address || shipToParsed?.address || "",
      dayPhone: shipToParsed?.DayPhone || shipToParsed?.dayPhone || "",
      eveningPhone: shipToParsed?.EveningPhone || shipToParsed?.eveningPhone || "",
      mobilePhone: shipToParsed?.MobilePhone || shipToParsed?.mobilePhone || ""
    };

    // =====================================================
    // 4️⃣ ITEMS - Ya vienen como array en el JSON
    // =====================================================
    // Buscar items en diferentes posibles propiedades
    const itemsArray = jsonData.items || jsonData.Items || jsonData.Details || [];
    normalized.items = (Array.isArray(itemsArray) ? itemsArray : []).map(item => ({
      deliveryNumber: item.DeliveryNumber || item.deliveryNumber || "",
      workOrder: item.WorkOrder || item.workOrder || "",
      lineNumber: item.LineNumber || item.lineNumber || "",
      itemId: item.ItemId || item.itemId || "",
      itemDescription: item.ItemDescription || item.itemDescription || "",
      LpnNumber: item.LpnNumber || item.LpnNumber || "",
      inventory: item.inventory || item.Inventory || "",
      serviceType: item.serviceType || item.servicetype || "",
      quantityUOM: item.quantityUOM || item.QuantityUOM || "",
      returnable: item.returnable || item.Returnable || "",
      packInstruction: item.packInstruction || item.PackInstruction || ""
    }));

    // =====================================================
    // 5️⃣ FOOTER
    // =====================================================
    const footerArray = jsonData.footer || jsonData.Footer || [];
    normalized.footer = (Array.isArray(footerArray) ? footerArray : []).map(f => ({
      totalWeight: f.TotalWeight || f.totalWeight || "",
      userName: f.UserName || f.userName || "",
      totalVolume: f.TotalVolume || f.totalVolume || ""
    }));



    // =====================================================
    // 6️⃣ CONTAINERS DATA - VERSIÓN QUE AGREGA TODOS LOS ITEMS
    // =====================================================
    normalized.containersData = {};

    if (typeof jsonData.containersData === "string") {

      try {
        console.log("\nProcesando Datos de Contenedores...");
        let jsonStr = jsonData.containersData.trim();
        // evitar strings vacíos
        if (!jsonStr || jsonStr === "null" || jsonStr === "{}") {
          return normalized;
        }
        if (!jsonStr.startsWith("[")) {
          jsonStr = `[${jsonStr}]`;
        }
        const containersArray = JSON.parse(jsonStr);
        if (!Array.isArray(containersArray) || containersArray.length === 0) {
          return normalized;
        }
        const allItems = [];
        let totalWeight = 0;
        let totalCost = 0;

        containersArray.forEach(container => {
          if (!container || typeof container !== "object") return;
          const items = Array.isArray(container.items) ? container.items : [];
          items.forEach(item => {
            if (!item || typeof item !== "object") return;
            // evitar registros fantasma
            if (
              !item.deliveryNumber &&
              !item.customerOrder &&
              !item.workOrder &&
              !item.container &&
              !item.sontainer &&
              !item.weight &&
              !item.cost
            ) {
              return;
            }
            const weight = parseFloat(item.weight || 0) || 0;
            const cost = parseFloat(item.cost || 0) || 0;
            totalWeight += weight;
            totalCost += cost;
            allItems.push({
              deliveryNumber: item.deliveryNumber || "",
              customerOrder: item.customerOrder || "",
              workOrder: item.workOrder || "",
              container: item.container || item.container || "",
              weight: item.weight || "",
              cost: item.cost || ""
            });
          });
        });
        if (allItems.length > 0) {
          normalized.containersData = {
            vendorId: containersArray[0]?.vendorId || "",
            customerId: containersArray[0]?.customerId || "",
            shipTo: containersArray[0]?.shipTo || "",
            items: allItems,
            totals: {
              totalWeight: totalWeight.toFixed(2),
              totalCost: `$${totalCost.toFixed(2)}`
            }
          };
          console.log(`Contenedores procesados: ${allItems.length}`);
        }
      } catch (error) {
        console.error("Error proccontainer: item.containeresando containers:", error.message);
        normalized.containersData = {};
      }
    }
  }

  static #getEmptyStructure() {
    return {
      priorityName: "",
      IdGpoPedidos: "",
      carrierServices: "",
      shipmentNumber: "",
      airwayBill: "",
      serviceLevel: "",
      eta: "",
      shipFrom: { address: "", contactName: "", dayPhone: "", eveningPhone: "", mobilePhone: "" },
      shipTo: { address: "", contactName: "", dayPhone: "", eveningPhone: "", mobilePhone: "" },
      items: [],
      footer: [],
      containersData: {}
    };
  }
}

module.exports = DataMapper;
