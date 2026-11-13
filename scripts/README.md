# Utilidades y Scripts

Este directorio contiene scripts y utilidades para soportar funcionalidades especiales del sistema.

## Scripts Disponibles

### 1. `generate-puter-jwt.js`

Genera JWT Secret para autenticación con Puter en el backend.

**Uso:**
```bash
node scripts/generate-puter-jwt.js
```

**Requisitos:**
```bash
npm install @heyputer/puter.js
npm install inquirer
```

**Descripción:**
- Inicia sesión en Puter automáticamente
- Solicita una contraseña (opcional)
- Genera un JWT Secret robusto
- Exporta configuración para `.env.local`

**Ejemplo de salida:**
```
🔐 Generador de JWT Secret para Puter

📋 Iniciando sesión con Puter...
   (Esto puede abrir una ventana pidiendo autorización)

✅ Sesión iniciada!

👤 Usuario: tu-usuario.com
🔗 Perfil: https://puter.com/@tu-usuario

📝 Versión 1 (Campo SIMPLE):
   tu-jwt-secret-genrico-aqui

📝 Versión 2 (Campo STRUNG - MEJOR PARA ENV):
   tu-jwt-secret-genrico-aqui

📝 Configuración de variables:
PUTER_USERNAME=tu-usuario.com
PUTER_PASSWORD=***

⚙️  Script de configuración:
   1. Copia los valores anteriores al archivo .env.local
   2. Reinicia la aplicación: npm run dev
   3. Prueba generación de imágenes
```

## Configuración de Puter

### Paso 1: Ejecutar el script

```bash
node scripts/generate-puter-jwt.js
```

### Paso 2: Copiar configuración

Copia las variables de entorno generadas al archivo `.env.local`:

```env
PUTER_USERNAME=usuario@puter.com
PUTER_PASSWORD=tu-password-secreto
NEXT_PUBLIC_PUTER_JWT_SECRET=tu-jwt-secret-genrico-aqui
```

### Paso 3: Instalar dependencias

```bash
npm install @heyputer/puter.js inquirer
```

### Paso 4: Reiniciar aplicación

```bash
npm run dev
```

## Troubleshooting

### Error: "PUTER_JWT_SECRET: unhandled Rejection"

**Solución:**
1. Asegúrate de tener `@heyputer/puter.js` instalado
2. Comprueba que el JWT secret es válido
3. Verifica que el usuario es una cuenta maestra (no infantil)

### Error: "No pude iniciar sesión en Puter"

**Causas:**
- La cuenta no existe
- La contraseña es incorrecta
- Navegador bloqueó popups

**Solución:**
1. Abre Puter.com en una pestaña nueva
2. Inicia sesión manualmente
3. Vuelve a ejecutar el script

### Error: "PUTER_JWT_SECRET: invalid anthropic_tool_use"

**Solución:**
1. Verifica que el JWT secret es **solo** el secreto, no el token completo
2. Asegúrate de que el secret tenga **minimo 16 caracteres**
3. El valor debe ser solo texto plano, no JSON

## Referencias

- [Puter.js Official Docs](https://docs.heyputer.com/)
- [JWT Authentication](https://docs.heyputer.com/s/uidk)
- [Configuración completa de Puter](../docs/PUTER_IMAGE_PROXY.md)