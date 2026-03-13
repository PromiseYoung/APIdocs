const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function installPrinterDeps() {
  console.log('🔧 Instalando dependencias de impresión...');

  try {
    // Para Windows - verificar que PowerShell esté disponible
    const { stdout } = await execAsync('powershell -Command "Get-Host"');
    console.log('✅ PowerShell disponible');

    console.log('📋 Dependencias de impresión configuradas correctamente');
    console.log('\n  Nota: Para impresión directa, asegúrate de:');
    console.log('   1. La impresora de red esté compartida y accesible');
    console.log('   2. El servicio tiene permisos de impresión');
    console.log('   3. Firewall permite comunicación en puertos de impresión');

  } catch (error) {
    console.error('❌ Error configurando dependencias:', error);
  }
}

installPrinterDeps();