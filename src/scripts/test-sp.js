const { executeQuery } = require('../config/database');

async function testDB() {
  try {
    console.log('🧪 TESTEANDO CONEXIÓN A BD...');

    // Probar una consulta simple
    const result = await executeQuery('SELECT 1 as test');
    console.log('✅ CONEXIÓN OK - Resultado:', result);

    // Probar el SP
    console.log('🧪 EJECUTANDO SP...');
    const spResult = await executeQuery('EXEC dbo.SPWC_LNV_FNC07');
    console.log('✅ SP RESULT:', JSON.stringify(spResult, null, 2));
    console.log('Tipo:', typeof spResult);
    console.log('¿Es array?', Array.isArray(spResult));
    console.log('Longitud:', spResult?.length);

    if (Array.isArray(spResult)) {
      console.log('Contenido del array:');
      spResult.forEach((item, index) => {
        console.log(`[${index}]`, item);
      });
    }

  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

testDB();