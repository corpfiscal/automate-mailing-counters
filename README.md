# Counter Print Reporter

Sistema automatizado para consultar contadores de impresoras via SNMP, generar reportes PDF y enviarlos por correo. Ejecutado mediante CRON job configurable con retry automatico ante fallos.

---

## Flujo de Ejecucion

```
Impresoras (SNMP)      Se consultan todas en paralelo via Promise.allSettled
        |
        v
Lectura de datos       Se separan resultados exitosos de errores
        |
        v
Generacion de PDF      Se genera en memoria (sin escribir a disco)
        |
        v
Envio por correo       Adjunta el PDF buffer a todos los destinatarios de MAIL_TO
```

Si el pipeline falla, se reintenta automaticamente (configurable via `MAX_RETRIES`).
Si todos los intentos fallan, se envia una notificacion de error a `ERROR_MAIL_TO`.

---

## Estructura del Proyecto

```
src/
├── index.ts                 # Entry point: CRON setup, retry logic, pipeline
├── config/
│   ├── env.ts               # Variables de entorno tipadas + validacion fail-fast
│   └── printers.ts          # Inventario de impresoras + OIDs SNMP
├── types/
│   ├── index.ts             # Tipos centrales (Printer, PrinterResult, EnvConfig)
│   └── net-snmp.d.ts        # Type declarations para libreria sin @types
├── services/
│   ├── printer.service.ts   # Consultas SNMP con Promise.allSettled
│   ├── pdf.service.ts       # Generacion de reportes PDF en memoria
│   └── mail.service.ts      # Envio de reportes + notificaciones de error
├── templates/
│   └── template.pdf         # Template base para los reportes
└── utils/
    └── date.util.ts         # Funciones puras de formato de fecha
```

---

## Requisitos

- **Node.js** v18+
- Acceso a la red local donde estan las impresoras
- **SNMP** habilitado en los dispositivos
- Cuenta de correo con acceso **SMTP** (Gmail con App Password recomendado)

---

## Instalacion

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd automate-mailing-counters

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores reales
```

---

## Configuracion

### Variables de Entorno (.env)

Copiar `.env.example` como `.env` y llenar los valores. **Nunca commitear el `.env` real.**

| Variable | Descripcion | Default |
|---|---|---|
| `SNMP_COMMUNITY` | Community string SNMP | `public` |
| `SMTP_HOST` | Host del servidor SMTP | **requerido** |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_SECURE` | Usar TLS directo (no STARTTLS) | `false` |
| `SMTP_USER` | Usuario SMTP | **requerido** |
| `SMTP_PASS` | Password SMTP (App Password en Gmail) | **requerido** |
| `MAIL_FROM` | Remitente del correo | **requerido** |
| `MAIL_TO` | Destinatarios del reporte (comma-separated) | **requerido** |
| `ERROR_MAIL_TO` | Destinatarios de errores / soporte (comma-separated) | **requerido** |
| `CRON_SCHEDULE` | Expresion CRON para el schedule | `0 8 28-31 * *` |
| `MAX_RETRIES` | Intentos maximos ante fallo | `3` |
| `RETRY_DELAY_SECONDS` | Espera entre reintentos (segundos) | `60` |

### Gmail — App Password

Gmail no permite usar la password normal para SMTP. Necesitas:

1. Activar verificacion en 2 pasos en tu cuenta Google
2. Ir a Seguridad > Passwords de aplicaciones
3. Generar una App Password
4. Usar esa password en `SMTP_PASS`

### Impresoras

Editar `src/config/printers.ts` para agregar o quitar impresoras:

```typescript
const printers: ReadonlyArray<Printer> = [
  { name: 'Ricoh 3054', ip: '192.168.1.125' },
  { name: 'Ricoh 3555', ip: '192.168.1.98' },
];
```

---

## Uso

### Scripts disponibles

| Script | Descripcion |
|---|---|
| `npm run dev` | Inicia el CRON en modo desarrollo (tsx, sin compilar) |
| `npm run dev:run` | Ejecuta el pipeline inmediatamente (dev) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta el build compilado con CRON activo |
| `npm run start:run` | Ejecuta inmediatamente (produccion) |
| `npm run typecheck` | Verifica tipos sin compilar |

### Modo CRON (produccion)

```bash
npm run build
npm start
# El proceso se queda corriendo y ejecuta segun CRON_SCHEDULE
```

### Ejecucion inmediata (testing)

```bash
npm run dev:run
# Ejecuta el pipeline una vez y luego se queda en modo CRON
```

---

## CRON Schedule

La expresion CRON por defecto es `0 8 28-31 * *` — ejecuta a las 8:00 AM en los dias 28 al 31 de cada mes.

```
  ┌────────── minuto (0-59)
  | ┌──────── hora (0-23)
  | | ┌────── dia del mes (1-31)
  | | | ┌──── mes (1-12)
  | | | | ┌── dia de la semana (0-7)
  | | | | |
  0 8 28-31 * *
```

node-cron ignora automaticamente dias que no existen en un mes. Esto significa que en febrero (28 dias) solo corre el dia 28, y en meses de 30 dias corre del 28 al 30. Con que el pipeline sea exitoso en **uno** de esos dias, el reporte mensual queda cubierto.

---

## Retry y Manejo de Errores

El sistema tiene dos capas de resiliencia:

1. **Retry automatico** — Si el pipeline falla (red, SNMP, SMTP), se reintenta hasta `MAX_RETRIES` veces con un delay de `RETRY_DELAY_SECONDS` entre intentos.

2. **Notificacion de error** — Si todos los intentos fallan, se envia un correo a `ERROR_MAIL_TO` con el detalle del error y stack trace.

---

## Configuracion de TypeScript (tsconfig.json)

El proyecto usa TypeScript en **strict mode**. Cada opcion del `tsconfig.json` tiene un proposito:

### Compilacion

| Opcion | Valor | Para que sirve |
|---|---|---|
| `target` | `ES2022` | Genera JS moderno con soporte nativo de async/await, optional chaining, nullish coalescing. No necesitamos polyfills porque Node 18+ soporta ES2022. |
| `module` | `commonjs` | Genera `require()`/`module.exports` que Node.js entiende nativamente. Si usaras ESM puro, seria `nodenext`. |
| `lib` | `["ES2022"]` | Le dice al compilador que APIs de JS estan disponibles (Promise, Map, Array.at, etc.). |
| `outDir` | `./dist` | Donde van los archivos compilados `.js`. Separado de `src/` para no mezclar fuente con output. |
| `rootDir` | `./src` | Raiz del codigo fuente. TypeScript preserva la estructura de carpetas de `src/` dentro de `dist/`. |

### Strict Mode

| Opcion | Para que sirve |
|---|---|
| `strict` | Activa TODAS las validaciones estrictas de TypeScript de un solo golpe. Incluye: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, entre otras. Es el nivel minimo recomendado para proyectos profesionales. |
| `noUnusedLocals` | Error si declaras una variable y no la usas. Previene codigo muerto. |
| `noUnusedParameters` | Error si una funcion tiene parametros que no usa. Indica logica incompleta o refactor pendiente. |
| `noImplicitReturns` | Error si una funcion tiene paths que no retornan valor. Previene bugs donde una funcion "silenciosamente" retorna `undefined`. |
| `noFallthroughCasesInSwitch` | Error si un `case` del switch no tiene `break`/`return`. Previene el clasico bug de fallthrough accidental. |

### Interop y Calidad

| Opcion | Para que sirve |
|---|---|
| `esModuleInterop` | Permite usar `import x from 'lib'` con librerias CommonJS (como `dotenv`). Sin esto, necesitarias `import * as x from 'lib'`. |
| `skipLibCheck` | No verifica los tipos dentro de `node_modules`. Acelera la compilacion y evita conflictos entre versiones de @types. |
| `forceConsistentCasingInFileNames` | Error si importas un archivo con casing diferente al real (`./Config` vs `./config`). Previene bugs en Linux donde el filesystem es case-sensitive. |
| `resolveJsonModule` | Permite importar archivos `.json` directamente con tipos inferidos. |
| `declaration` | Genera archivos `.d.ts` junto al `.js`. Util si alguien quisiera importar este proyecto como libreria. |
| `sourceMap` | Genera `.js.map` que conecta el JS compilado con el TS original. Los stack traces muestran lineas del `.ts`, no del `.js`. |

---

## Stack Tecnologico

| Dependencia | Uso |
|---|---|
| `net-snmp` | Consultas SNMP a impresoras de red |
| `pdf-lib` | Manipulacion de PDFs (leer template, dibujar texto) |
| `nodemailer` | Envio de correos via SMTP |
| `node-cron` | Scheduling de tareas (CRON dentro de Node.js) |
| `dotenv` | Carga de variables de entorno desde `.env` |
| `typescript` | Compilador TypeScript |
| `tsx` | Ejecucion directa de TypeScript en desarrollo |
