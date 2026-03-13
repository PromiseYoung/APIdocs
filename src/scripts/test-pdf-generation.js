const PDFService = require('../services/pdfService');
const PrinterService = require('../services/printerService');
const fs = require('fs-extra');

async function testPDFGeneration() {
    try {
        console.log('Probando generación de PDF...');

        const testData = {
            IdGpoPedidos: "615869",
            carrierServices: "DHL",
            shipmentNumber: "LNV01",
            serviceLevel: "JD-Premier",
            airwayBill: "LNV01",
            eta: "04/02/2026",
            priorityName: "JD-Premier",
            shipFrom: {
                address: "Poniente 140 Numero 671-A, Col. Industrial Vallejo Azcapotzalco Mexico City, 02300, Mexico",
                contactName: "Salvador Gayoso",
                dayPhone: "+52 (55) 1672-3160 Ext.601",
                eveningPhone: "",
                mobilePhone: "+52 (55) 6960-6765"
            },
            shipTo: {
                address: "5 de Febrero 1675 Los Olivos, La Paz, BCS, 23040, MX Contact: ",
                dayPhone: "5560674680",
                eveningPhone: "5560674680",
                mobilePhone: ""
            },
            items: [
                {
                    deliveryNumber: "8980148786",
                    workOrder: "4828171591",
                    lineNumber: "40",
                    itemId: "5D10S39686",
                    itemDescription: "DISPLAY LCD MODULE C 20WE Mutto+AUO FHD",
                    lpnNumber: "SU-00000B6700A8",
                    inventory: "8SST50Z6758231SZ1A51935",
                    serviceType: "On Site",
                    quantityUOM: "1 EA",
                    returnable: "Yes",
                    packInstruction: "4828171591"
                },
                {
                    deliveryNumber: "8980148786",
                    workOrder: "4828171591",
                    lineNumber: "30",
                    itemId: "5B21B36503",
                    itemDescription: "BDPLANAR MB C20WE WIN I51135_UMA8G_TPMWW",
                    lpnNumber: "SU-00000E3D7966",
                    inventory: "8S5B21B36503C1KS268013J",
                    serviceType: "On Site",
                    quantityUOM: "1 EA",
                    returnable: "Yes",
                    packInstruction: "4828171591"
                },
                {
                    deliveryNumber: "8980148786",
                    workOrder: "4828171591",
                    lineNumber: "10",
                    itemId: "5T10S33179",
                    itemDescription: "TAPE Removable Tape C 20WE R&L",
                    lpnNumber: "SU-00000ED2EFAE",
                    inventory: "",
                    serviceType: "On Site",
                    quantityUOM: "1 EA",
                    returnable: "Yes",
                    packInstruction: "4828171591"
                },
                {
                    deliveryNumber: "8980148786",
                    workOrder: "4828171591",
                    lineNumber: "20",
                    itemId: "5C10S30194",
                    itemDescription: "CABLE EDP cable C 20WE",
                    lpnNumber: "SU-000010ECC42B",
                    inventory: "",
                    serviceType: "PART SALES",
                    quantityUOM: "1 EA",
                    returnable: "Yes",
                    packInstruction: "4828171591"
                }
            ],
            footer: [
                {
                    totalWeight: "7911.92 lbs",
                    totalVolume: "5250,00 CUCENTIMETER"
                }
            ],
            containersData: {
                vendorId: "30003668",
                customerId: "8055319326",
                shipTo: "5 de Febrero 1675 Los Olivos, La Paz, BCS, 23040, MX",

                items: [
                    {
                        deliveryNumber: "8980148786",
                        customerOrder: "4828171591",
                        serviceOrderNumber: "4020858122",
                        container: "C000007906",
                        weight: "2994.03",
                        cost: "$167.03"
                    }
                ],

                totals: {
                    totalWeight: "2994.03",
                    totalCost: "$167.03"
                }
            }
        };

        const pdfBuffer = await PDFService.generatePackList(testData);

        await fs.ensureDir('../temp/previews');
        await fs.writeFile('../temp/previews/test-packlist.pdf', pdfBuffer);


        // console.log('📄 PDF generado: test-output/test-packlist.pdf');
        // console.log(`📏 Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

        // // 2️⃣ Imprimir solo una vez
        // console.log('🖨️ Enviando a impresión...');
        // const printResult = await PrinterService.printPDF(pdfBuffer, "B4005029");

        // if (printResult.success) {
        //     console.log('PDF enviado a impresión');
        //     console.log(`Impresora: ${printResult.printer}`);
        //     console.log(`Job ID: ${printResult.jobId}`);
        // } else {
        //     console.log('❌ Error al imprimir:', printResult.error);
        // }

        // 3️⃣ Finalizar script para evitar re-ejecuciones
        console.log("\n Finalizando script...\n");
        process.exit(0);

    } catch (error) {
        console.error('❌ Error generando PDF:', error);
        process.exit(1);
    }
}

testPDFGeneration();