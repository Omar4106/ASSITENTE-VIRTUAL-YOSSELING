/**
 * Script para generar JWT Secret para autenticación con Puter.
 *
 * Uso:
 *  node scripts/generate-puter-jwt.js
 *
 * Requiere:
 *  npm install @heyputer/puter.js
 */

const { puter } = require('@heyputer/puter.js');
const inquirer = require('inquirer');

async function generateJWT() {
  console.log('\n🔐 Generador de JWT Secret para Puter\n');

  // Iniciar sesión con Puter (auto elige método)
  console.log('📋 Iniciando sesión con Puter...');
  console.log('   (Esto puede abrir una ventana pidiendo autorización)\n');

  try {
    // Intentar iniciar sesión
    await puter.auth.login();
    console.log('✅ Sesión iniciada!\n');

    const user = await puter.auth.getUser();
    console.log(`👤 Usuario: ${user.username} (@${user.id})`);
    console.log(`🔗 Perfil: ${user.profileUrl}\n`);

    // Solicitar contraseña (opcional, solo para generar JWT)
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'password',
        message: 'Introduce la contraseña de tu cuenta (opcional, solo si quieres una clave):',
        mask: true,
      },
    ]);

    // Generar JWT
    const secretAnswers = await inquirer.prompt([
      {
        type: 'password',
        name: 'secret',
        message: 'Introduce un JWT Secret (se recomienda 32 caracteres aleatorios):',
        validate: (value) => value.length >= 16 || 'Mínimo 16 caracteres',
      },
    ]);

    const userId = user.id.replace('@', '');
    const username = user.username.replace('@', '');

    const secret = secretAnswers.secret;
    const token = puter.uidk.generateJWT(secret, { username, password: answers.password });

    console.log('\n' + '='.repeat(60));
    console.log('✅ JWT Secret generado exitosamente!\n');
    console.log('📝 Versión 1 (Campo SIMPLE):');
    console.log(`   ${secret}`);
    console.log('\n📝 Versión 2 (Campo STRUNG - MEJOR PARA ENV):');
    console.log(`   ${secret.substring(0, 32)}...${secret.substring(secret.length - 8)}`);
    console.log('   type=JWT_SECRET, secret=puter:${secret}');
    console.log('\n📝 Versión 3 (Type-1 env var - NEXT_PUBLIC_):');
    console.log(`   NEXT_PUBLIC_PUTER_JWT_SECRET=${secret}`);
    console.log('\n📝 Versión 4 (Type-1 env var - PUTER_):');
    console.log(`   PUTER_JWT_SECRET=${secret}`);
    console.log('\n📝 Configuración de variables:')
    console.log(`   PUTER_USERNAME=${username}`);
    if (answers.password) {
      console.log(`   PUTER_PASSWORD=${'***'}`);
    }
    console.log('='.repeat(60) + '\n');

    console.log('📋 Archivo .env.local:\n');
    console.log(`PUTER_USERNAME=${username}`);
    if (answers.password) {
      console.log(`PUTER_PASSWORD=${answers.password.replace(/'/g, "\\'")}`);
      console.log(`# El JWT secret ya está arriba con NEXT_PUBLIC_PUTER_JWT_SECRET`);
    } else {
      console.log(`NEXT_PUBLIC_PUTER_JWT_SECRET=${secret}`);
    }
    console.log('\n');

    console.log('⚙️  Script de configuración:\n');
    console.log('   1. Copia los valores anteriores al archivo .env.local');
    console.log('   2. Reinicia la aplicación: npm run dev');
    console.log('   3. Prueba generación de imágenes\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Si no hay argumentos, ejecutar el prompt interactivamente
if (require.main === module) {
  generateJWT().catch(console.error);
}

module.exports = { generateJWT };