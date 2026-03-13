const PDFDocument = require('pdfkit');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
// ESTRUCTURA DEL DOCUMENTO PACKLIST NO TOCAR  NI MOVER NINGUN METODO

// FUNCIÓN PARA DIBUJAR CÓDIGO DE BARRAS DE SHIPMENT
function drawShipmentBarcode(doc, shipmentNumber, x, y, width) {
  if (!shipmentNumber || shipmentNumber.trim() === '') {
    return null; // Retorna null si no hay número
  }
  const text = shipmentNumber.trim();
  try {
    const canvas = createCanvas();
    const barcodeHeight = 44;
    // Generar código de barras CODE128
    JsBarcode(canvas, text, {
      format: 'CODE128',
      height: barcodeHeight,
      width: 2,
      displayValue: true,
      text: text,
      fontSize: 11,
      margin: 8,
      background: '#FFFFFF',
      lineColor: '#000000'
    });
    const buffer = canvas.toBuffer('image/png');
    const barcodeWidth = Math.min(width - 20, canvas.width);
    const centeredX = x + (width - barcodeWidth) / 2;

    // Dibujar código de barras
    doc.image(buffer, centeredX, y, {
      width: barcodeWidth,
      height: barcodeHeight
    });

    // Retornar información útil
    return {
      success: true,
      yPosition: y,
      height: barcodeHeight,
      width: barcodeWidth,
      centeredX: centeredX
    };

  } catch (error) {
    console.error('❌ Error en drawShipmentBarcode:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
/*
=============================PARTE PRINCIPAL DEL DOCUMENTO======================
*/

// CLASE PRINCIPAL DE TODO EL DOCUMENTO
class PDFService {


  static generatePackList(data, includeContainers = true) {
    return new Promise((resolve, reject) => {
      try {

        console.log('\n Servicio de PDF recibió:');
        console.log('  IdGpoPedidos:', data.IdGpoPedidos);
        console.log('  carrierServices:', data.carrierServices);
        console.log('  items length:', data.items?.length);
        console.log('  shipFrom:', data.shipFrom?.address?.substring(0, 50) + '...');
        console.log('  shipTo:', data.shipTo?.address?.substring(0, 50) + '...');
        // Verificar campos críticos
        if (!data.IdGpoPedidos) {
          console.warn('IdGpoPedidos está vacío');
        }
        if (!data.items || data.items.length === 0) {
          console.warn('No hay items');
        }
        const doc = new PDFDocument({
          margins: 36,
          size: [792, 612],
          // layout: 'landscape',
          bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // -----------------------------------
        // 1. Construcción del documento
        // -----------------------------------
        this._buildHeader(doc, data);
        this._buildShipInfo(doc, data);
        this._buildItemsTable(doc, data);

        //AGREGA LOS CONTENEDORES
        if (
         includeContainers && data.containersData &&
         Array.isArray(data.containersData.items) && 
        data.containersData.items.length > 0 && 
        data.containersData.items.some(item => 
          (item.container && item.container.trim() !== "") ||
          (item.deliveryNumber && item.deliveryNumber.trim() !== "") ||
          (item.weight && !isNaN(item.weight) && Number(item.weight) > 0) ||
          (item.cost && !isNaN(item.cost) && Number(item.cost) > 0)
          )
          ) {
          console.log(`\n\n Anexo de contenedores se han agregado (${data.containersData.items.length} items validos)` );
          doc.addPage();
          this._buildContainersSection(doc, data.containersData);
        } else if(includeContainers) {
          console.log("\n Contenedores omitidos: la estructura del documento se recibio vacia o sin informacion");
          }

        // -----------------------------------
        // 2. FOOTERS EN TODAS LAS PÁGINAS
        // -----------------------------------
        const pageRange = doc.bufferedPageRange();
        const totalPages = pageRange.count;

        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          this._buildFooter(doc, data, i + 1, totalPages);
        }
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }


  static _buildHeader(doc, data) {
    const pageWidth = doc.page.width;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;

    const y = 40; // altura fija del header
    const fechaHora = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City"
    });

    // =====================================================
    // IZQUIERDA → PRIORITY
    // =====================================================
    doc.font('Times-Bold')
      .fontSize(12)
      .text(
        `Priority: ${data.priorityName || ''}`,
        marginLeft,
        y,
        { align: 'left' }
      );

    // =====================================================
    // CENTRO → TÍTULO
    // =====================================================
    doc.font('Times-Bold')
      .fontSize(19)
      .text(
        'PACK LIST',
        0,
        y - 8, // pequeño ajuste vertical
        {
          width: pageWidth,
          align: 'center',
          underline: true
        }
      );

    // =====================================================
    // DERECHA → FECHA
    // =====================================================
    doc.font('Times-Roman')
      .fontSize(9)
      .text(
        `Generated on: ${fechaHora}`,
        pageWidth - marginRight - 250,
        y,
        {
          width: 250,
          align: 'right'
        }
      );

    doc.moveDown(2);
  }



  static async _buildShipInfo(doc, data) {

    // 📌 CONFIG DINÁMICA DE LA PÁGINA
    const margin = doc.page.margins.left;     // ej: 20
    const usableWidth = doc.page.width - margin * 2;  // ej: 792 - 40 = 752
    const startX = margin;
    const startY = doc.y;
    const tableHeight = 149;
    const cellPadding = 10;

    // 📏 TABLA PRINCIPAL (ANCHO ADAPTADO)
    doc.rect(startX, startY, usableWidth, tableHeight).stroke();

    // 📌 DIVISIONES 50/50
    const midX = startX + usableWidth / 2;
    const midY = startY + tableHeight / 2;

    doc.moveTo(midX, startY).lineTo(midX, startY + tableHeight).stroke();
    doc.moveTo(startX, midY).lineTo(startX + usableWidth, midY).stroke();

    // 🎯 POSICIONES IZQ / DER
    const leftX = startX + cellPadding;
    const rightX = midX + cellPadding;

    let currentY = startY + cellPadding;

    // 📌 CONFIG TEXTO
    const labelWidth = 152;
    const valueStart = labelWidth + 17;

    // -----------------------------------------------------------
    // 🟦 CUADRANTE SUPERIOR IZQUIERDO (Carrier, AWB, Etc.)
    // -----------------------------------------------------------
    doc.font('Times-Roman').fontSize(9)

      .text('Carrier Service', leftX, currentY)
      .text(':', leftX + labelWidth, currentY)
      .text(data.carrierServices || 'N/A', leftX + valueStart, currentY)

      .text('Customer', leftX, currentY + 18)
      .text(':', leftX + labelWidth, currentY + 18)
      .text(data.Customer || 'N/A', leftX + valueStart, currentY + 18)

      .text('Service Level', leftX, currentY + 36)
      .text(':', leftX + labelWidth, currentY + 36)
      .text(data.serviceLevel || 'N/A', leftX + valueStart, currentY + 36)

      .text('ETA', leftX, currentY + 54)
      .text(':', leftX + labelWidth, currentY + 54)
      .text(data.eta || 'N/A',
        leftX + valueStart, currentY + 54
      );

    // -----------------------------------------------------------
    // 🟦 CUADRANTE SUPERIOR DERECHO (Shipment con código de barras)
    // -----------------------------------------------------------
    const colWidth = doc.page.width - rightX - doc.page.margins.right;

    // 1️⃣ TEXTO DEL SHIPMENT (igual que antes)
    doc.text('Shipment #', rightX, currentY)
      .text(':', rightX + 50, currentY)
      .text(data.shipmentNumber || 'N/A', rightX + 70, currentY);

   const internalCodeX = rightX + 217;
   doc.text('Internal Code', internalCodeX, currentY)
      .text(':', internalCodeX + 50, currentY)
      .text(data.InternalCode || 'N/A', internalCodeX + 70, currentY);

    if (data.shipmentNumber && data.shipmentNumber.trim() !== '') {
      // 2️⃣ POSICIÓN PARA EL CÓDIGO DE BARRAS
      const barcodeY = currentY + 14;

      // 3️⃣ LLAMAR A LA FUNCIÓN drawShipmentBarcode
      const barcodeResult = drawShipmentBarcode(
        doc,                    // Documento PDF
        data.shipmentNumber,    // Número de shipment
        rightX,                 // Posición X inicial
        barcodeY,               // Posición Y
        colWidth                // Ancho disponible
      );

      // 4️⃣ MANEJAR EL RESULTADO
      if (barcodeResult && barcodeResult.success) {
        // Código de barras generado exitosamente
        currentY = barcodeResult.yPosition + barcodeResult.height + 10;
      } else {
        // 6️⃣ FALLBACK si falla el código de barras
        doc.fontSize(9)
          .fillColor('#666666')
          .text(`Tracking: ${data.shipmentNumber}`,
            rightX,
            barcodeY + 10,
            { width: colWidth, align: 'left' });

        currentY = barcodeY + 30;
      }
    } else {
      // 7️⃣ SIN SHIPMENT NUMBER
      currentY += 20;
    }

    // Encabezados
    doc.font('Times-Bold').fontSize(8)
      .text('Ship From', leftX, currentY, {
        width: usableWidth / 2 - cellPadding * 2
      })
      .text('Ship To', rightX, currentY, {
        width: usableWidth / 2 - cellPadding * 2
      });

    // Direcciones
    const addressY = currentY + 14;

    doc.font('Times-Roman').fontSize(8)
      .text(data.shipFrom?.address || 'N/A', leftX, addressY, {
        width: usableWidth / 2 - cellPadding * 2
      })
      .text(data.shipTo?.address || 'N/A', rightX, addressY, {
        width: usableWidth / 2 - cellPadding * 2
      });

    // -----------------------------------------------------------
    // 🟦 TELÉFONOS (Day / Evening / Mobile)
    // -----------------------------------------------------------
    const phonesY = addressY + 18;

    const phoneCfg = {
      labelWidth: 54,
      colon: 47,
      value: 52,
    };

    const rowH = 9;

    // ✔️ Ship From
    doc.font('Times-Roman').fontSize(8);

    // Day
    doc.text('Day', leftX, phonesY)
      .text(':', leftX + phoneCfg.colon, phonesY)
      .text(data.shipFrom?.dayPhone || 'N/A', leftX + phoneCfg.value, phonesY);

    // Contact
    doc.text('Contact', leftX, phonesY + rowH)
      .text(':', leftX + phoneCfg.colon, phonesY + rowH)
      .text(data.shipFrom?.contactName || 'N/A', leftX + phoneCfg.value, phonesY + rowH);

    // Evening
    doc.text('Evening', leftX, phonesY + rowH * 2)
      .text(':', leftX + phoneCfg.colon, phonesY + rowH * 2)
      .text(data.shipFrom?.eveningPhone || 'N/A', leftX + phoneCfg.value, phonesY + rowH * 2);

    // Mobile
    doc.text('Mobile', leftX, phonesY + rowH * 3)
      .text(':', leftX + phoneCfg.colon, phonesY + rowH * 3)
      .text(data.shipFrom?.mobilePhone || 'N/A', leftX + phoneCfg.value, phonesY + rowH * 3);


    // ✔️ Ship To
    doc.text('Day', rightX, phonesY).text(':', rightX + phoneCfg.colon, phonesY)
      .text(data.shipTo?.dayPhone || 'N/A', rightX + phoneCfg.value, phonesY);

    doc.text('Contact', rightX, phonesY + rowH).text(':', rightX + phoneCfg.colon, phonesY + rowH)
      .text(data.shipTo?.contactName || 'N/A', rightX + phoneCfg.value, phonesY + rowH);

    doc.text('Evening', rightX, phonesY + rowH * 2).text(':', rightX + phoneCfg.colon, phonesY + rowH * 2)
      .text(data.shipTo?.eveningPhone || 'N/A', rightX + phoneCfg.value, phonesY + rowH * 2);

    doc.text('Mobile', rightX, phonesY + rowH * 3).text(':', rightX + phoneCfg.colon, phonesY + rowH * 3)
      .text(data.shipTo?.mobilePhone || 'N/A', rightX + phoneCfg.value, phonesY + rowH * 3);

    doc.moveDown(1.5);
  }


  //CONTENIDO DE LA TABLA DE ITEMS 
  static _buildItemsTable(doc, data) {

    const FOOTER_HEIGHT = 40;

    // 📐 Ancho útil real
    const usableWidth =  doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const startX = doc.page.margins.left;
    let currentY = doc.y;

    // 🎯 Distribución PERFECTA (100% exacto)
    const headers = [
      { text: 'Delivery #', pct: 0.09 },
      { text: 'Work Order', pct: 0.09 },
      { text: 'Line', pct: 0.05 },
      { text: 'Item Id', pct: 0.08 },
      { text: 'Item Description', pct: 0.16 },
      { text: 'LPN #', pct: 0.10 },
      { text: 'Inventory', pct: 0.10 },
      { text: 'Type', pct: 0.07 },
      { text: 'QTY/UOM', pct: 0.08 },
      { text: 'Return', pct: 0.06 },
      { text: 'Pack Instruction', pct: 0.12 }
    ].map(h => ({
      text: h.text,
      width: Math.round(h.pct * usableWidth)
    }));

    const SPACING = {
      headerHeight: 30,
      rowHeight: 26,
      cellPadding: 5,
      textOffsetY: 8
    };

    // 🎨 Encabezados
    const drawHeaders = (y) => {
      let x = startX;

      doc.font('Helvetica-Bold').fontSize(9);

      headers.forEach(h => {
        doc.rect(x, y, h.width, SPACING.headerHeight)
          .fillAndStroke('#e0e0e0', '#000');

        doc.fillColor('#000')
          .text(h.text, x + SPACING.cellPadding, y + SPACING.textOffsetY, {
            width: h.width - SPACING.cellPadding * 2,
            align: 'center'
          });

        x += h.width;
      });

      return y + SPACING.headerHeight;
    };

    currentY = drawHeaders(currentY);

    // 🔄 Filas
    doc.font('Helvetica').fontSize(8);

    (data.items || []).forEach((item, i) => {

      // 🧻 Salto de página limpio
      if (
        currentY + SPACING.rowHeight >
        doc.page.height - doc.page.margins.bottom - FOOTER_HEIGHT
      ) {
        doc.addPage();
        currentY = drawHeaders(doc.page.margins.top);

       doc.font('Helvetica').fontSize(8);
      }

      let x = startX;

      // Fondo alternado
      if (i % 2 === 0) {
        doc.rect(startX, currentY, usableWidth, SPACING.rowHeight)
          .fill('#f5f5f5');
      }

      // Borde fila
      doc.rect(startX, currentY, usableWidth, SPACING.rowHeight)
        .stroke('#000');

      const rowData = [
        item.deliveryNumber ?? '',
        item.workOrder ?? '',
        item.lineNumber ?? '',
        item.itemId ?? '',
        item.itemDescription ?? '',
        item.LpnNumber ?? '',
        item.inventory ?? '',
        item.serviceType ?? '',
        item.quantityUOM ?? '',
        item.returnable ?? '',
        item.packInstruction ?? ''
      ];

      doc.font('Helvetica').fontSize(8).fillColor('#000');

      rowData.forEach((text, idx) => {
          doc.text(String(text), x + SPACING.cellPadding, currentY + SPACING.textOffsetY, {
            width: headers[idx].width - SPACING.cellPadding * 2,
            align: 'center'
          });

        x += headers[idx].width;
      });

      currentY += SPACING.rowHeight;
    });
  }



  // CONTENIDO DE LA SECCIÓN DE CONTENEDORES
  static _buildContainersSection(doc, containersData) {

    if (!containersData || !Array.isArray(containersData.items) || containersData.items.length === 0) {
      doc.font('Helvetica-Bold').fontSize(12)
        .fillColor('black')
        .text('No hay contenedores para mostrar', 30, doc.y + 20);
      return;
    }

    const margin = doc.page.margins.left;
    const usableWidth = doc.page.width - margin * 2;
    const startX = margin;
    let currentY = doc.y;

    // TÍTULO
    doc.font('Times-Bold').fontSize(17)
      .fillColor('#000000')
      .text('ANEXO DE CONTENEDORES', { align: 'center', underline: true });

    doc.moveDown(1);
    currentY = doc.y;

    // INFORMACIÓN BÁSICA
    doc.font('Times-Roman').fontSize(10);

    doc.text('Vendor ID:', startX, currentY);
    doc.text(containersData.vendorId || 'N/A', startX + 80, currentY);

    doc.text('Customer ID:', startX + 350, currentY);
    doc.text(containersData.customerId || 'N/A', startX + 450, currentY);

    currentY += 20;

    doc.text('Ship To:', startX, currentY);
    doc.text(containersData.shipTo || 'N/A', startX + 80, currentY, { width: usableWidth - 100 });

    doc.moveDown(2);
    currentY = doc.y;

    // COLUMNAS
    const headers = [
      { text: 'Delivery Number', pct: 0.18 },
      { text: 'Customer Order', pct: 0.16 },
      { text: 'Work Order', pct: 0.18 },
      { text: 'Container', pct: 0.18 },
      { text: 'Weight [Kg]', pct: 0.15 },
      { text: 'Cost', pct: 0.15 }
    ].map(h => ({ text: h.text, width: h.pct * usableWidth }));

    const headerHeight = 25;
    const rowHeight = 22;
    const pageBottom = doc.page.height - 80;

    // ENCABEZADOS
    const drawHeaders = () => {
      let x = startX;
      doc.font('Helvetica-Bold').fontSize(9);

      headers.forEach(h => {
        doc.rect(x, currentY, h.width, headerHeight)
          .fillAndStroke('#e0e0e0', '#000000');

        doc.fillColor('#000000')
          .text(h.text, x + 5, currentY + 7, {
            width: h.width - 10,
            align: 'center'
          });

        x += h.width;
      });

      currentY += headerHeight;
    };

    drawHeaders();

    // FILAS
    doc.font('Helvetica').fontSize(8);

    let rowIndex = 0;

    for (let item of containersData.items) {

      if (currentY + rowHeight > pageBottom) {
        doc.addPage();
        currentY = 40;
        drawHeaders();
      }

      // Fondo alternado
      if (rowIndex % 2 === 0) {
        doc.save();
        doc.rect(startX, currentY, usableWidth, rowHeight)
          .fill('#f5f5f5');
        doc.restore();
      }

      // Bordes
      doc.rect(startX, currentY, usableWidth, rowHeight)
        .strokeColor('#000000')
        .lineWidth(0.4)
        .stroke();

      let x = startX;
      const rowData = [
        item.deliveryNumber || '',
        item.customerOrder || '',
        item.workOrder || '',
        item.container || '',
        item.weight || '',
        item.cost || ''
      ];

      rowData.forEach((text, index) => {
        doc.fillColor('#000000')
          .text(text, x + 5, currentY + 6, {
            width: headers[index].width - 10,
            align: 'center'
          });

        x += headers[index].width;
      });

      currentY += rowHeight;
      rowIndex++;
    }

    // TOTALES (YA CORREGIDO!)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');

    let x = startX + headers[0].width + headers[1].width + headers[2].width;

    doc.text('Total:', x, currentY + 8, {
      width: headers[3].width,
      align: 'center'
    });

    doc.text(containersData.totals.totalWeight || '0.0',
      x + headers[3].width,
      currentY + 8,
      { width: headers[4].width, align: 'center' }
    );

    doc.text(containersData.totals.totalCost || '$0.00',
      x + headers[3].width + headers[4].width,
      currentY + 8,
      { width: headers[5].width, align: 'center' }
    );

    doc.moveDown(2);
  }


  // CONTENIDO DEL FOOTER PIE DE PAGINA
  static _buildFooter(doc, data, currentPage, totalPages) {

    // 📌 CONFIG DINÁMICA DE LA PÁGINA
    const margin = doc.page.margins.left;               // ej: 20
    const usableWidth = doc.page.width - margin * 2;    // ej: 792 - 40 = 752
    const startX = margin;

    // 📏 POSICIÓN INFERIOR REAL DEL FOOTER
    const bottomY = doc.page.height - margin - 11;

    // 📊 DATOS
    const footerData = data.footer && data.footer[0] ? data.footer[0] : {};
    const currentUser = footerData.userName || data.userName || 'Unknown User';
    const weight = footerData.totalWeight || data.totalWeight || '';
    const volume = footerData.totalVolume || data.totalVolume || '';

    // ------------------------------------------------------------------
    // 🧱 LÍNEA DE SEPARACIÓN (de lado a lado)
    // ------------------------------------------------------------------
    doc.moveTo(startX, bottomY - 10)
      .lineTo(startX + usableWidth, bottomY - 10)
      .strokeColor('#dddddd')
      .lineWidth(0.8)
      .stroke();

    // ------------------------------------------------------------------
    // 📐 COLUMNAS PROPORCIONALES
    // ------------------------------------------------------------------
    const colWidth = usableWidth / 4;

    const col1X = startX;
    const col2X = startX + colWidth;
    const col3X = startX + colWidth * 2;

    // ------------------------------------------------------------------
    // 📝 CONTENIDO DEL FOOTER
    // ------------------------------------------------------------------
    doc.font('Times-Roman')
      .fontSize(9)
      .fillColor('#000000');

    // COLUMNA 1 → Peso
    doc.text(`Total Weight: ${weight}`, col1X, bottomY, {
      width: colWidth,
      align: 'left'
    });

    doc.text(`Printed: ${currentUser}`, startX + colWidth, bottomY, { width: colWidth, align: 'left' });

    // COLUMNA 2 → Volumen
    doc.text(`Total Volume: ${volume}`, startX + colWidth * 2,  bottomY, {
      width: colWidth,
      align: 'left'
    });

    // COLUMNA 3 → Página actual / total
    doc.text(`${currentPage} of ${totalPages}`, startX + colWidth * 3, bottomY, {
      width: colWidth,
      align: 'right'
    });
  }
}

module.exports = PDFService;