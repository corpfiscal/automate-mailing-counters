# Guia de Buenas Practicas — Automate Mailing Counters

Este documento resume las decisiones tecnicas, patrones y buenas practicas
aplicadas en este proyecto. Esta pensado como referencia de estudio para
entender el **por que** detras de cada decision, no solo el **como**.

---

## 1. TypeScript Strict Mode

### Que es y por que importa

TypeScript sin `strict: true` es como un casco de bici sin abrochar — te da
una falsa sensacion de seguridad. El strict mode activa estas validaciones:

- **noImplicitAny**: Prohibe variables sin tipo explicito. Sin esto, TypeScript
  asume `any` cuando no puede inferir el tipo, y `any` desactiva TODAS las
  validaciones de ese valor. Es como tener un agujero en tu chaleco antibalas.

- **strictNullChecks**: `string` y `string | null` son tipos diferentes.
  Sin esto, puedes llamar `.toUpperCase()` en un valor que es `null` y
  TypeScript no te avisa — te enteras en produccion.

- **strictFunctionTypes**: Valida que los tipos de parametros de funciones
  sean compatibles. Sin esto, puedes pasar un callback con tipos incorrectos
  y TypeScript lo acepta.

### Regla de oro

Si arrancas un proyecto nuevo, SIEMPRE activa `strict: true` desde el dia 1.
Activarlo despues en un proyecto existente es doloroso porque cada archivo
tenia "permisos" implicitos que ahora se convierten en errores.

---

## 2. Functional Programming (FP)

### Por que FP y no OOP en este proyecto

Este proyecto es un **pipeline de datos**: entra informacion de impresoras,
se transforma en un PDF, y sale como un correo. Es un flujo lineal, no un
sistema con "objetos" que interactuan entre si.

FP se ajusta mejor porque:

- **Pipeline pattern**: `query -> transform -> output` se mapea directamente a
  composicion de funciones.
- **Inmutabilidad**: Usar `readonly` y `ReadonlyArray` previene bugs donde una
  funcion modifica datos que otra funcion todavia necesita.
- **Funciones puras**: Dado el mismo input, siempre retornan el mismo output.
  Esto las hace predecibles y faciles de testear.

### Patrones FP usados en este proyecto

#### Higher-Order Functions
```typescript
// withRetry recibe una funcion y retorna una funcion mejorada.
// No le importa QUE hace la operacion — solo agrega retry logic.
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
  attempt: number = 1
): Promise<T> => { ... };
```

#### Promise.allSettled + reduce
```typescript
// En lugar de un loop con try/catch y push() (mutacion),
// usamos allSettled + reduce para separar exitos de errores
// de forma inmutable.
const settlements = await Promise.allSettled(printers.map(queryPrinter));
return settlements.reduce<PrinterQueryResponse>(
  (acc, settlement) => { ... },
  { results: [], errors: [] }
);
```

#### Arrow Functions como expresiones
```typescript
// Las funciones son valores. Se asignan a constantes,
// se pasan como argumentos, se retornan de otras funciones.
const getTimestamp = (): string =>
  new Date().toISOString().replace(/[:.]/g, '-');
```

### Cuando NO usar FP

FP no es una religion. Si tu dominio tiene entidades con estado que cambian
(ej. un carrito de compras, un juego), OOP puede ser mas natural.
La clave es elegir el paradigma que mejor se ajuste al problema.

---

## 3. Seguridad

### Variables de entorno y secretos

**NUNCA** hardcodear credenciales en el codigo. Siempre usar variables de entorno.

```
# MAL (el password queda en git para siempre)
const password = 'pbfb cmsh bodd fivo';

# BIEN (el password vive solo en .env, que esta en .gitignore)
const password = requireEnv('SMTP_PASS');
```

Reglas:
- El archivo `.env` NUNCA se commitea. Esta en `.gitignore`.
- El archivo `.env.example` SI se commitea — es el template sin secretos.
- Si un secreto se commitea por accidente, **rotalo inmediatamente**.
  Borrarlo del repo no es suficiente porque queda en el git history.

### .gitignore como primera linea de defensa

El `.gitignore` debe existir ANTES de hacer el primer commit del proyecto.
Si lo agregas despues, los archivos que ya se committearon siguen en el
historial de git.

Archivos que SIEMPRE deben estar en .gitignore:
- `.env` (credenciales)
- `node_modules/` (dependencias, pueden pesar GB)
- `dist/` (output de build, se regenera)
- `output/` o cualquier carpeta de artifacts generados
- `.DS_Store`, `Thumbs.db` (archivos del sistema operativo)

### Gmail App Passwords

Gmail NO permite usar la password de tu cuenta para SMTP. Requiere una
"App Password" que es un token de 16 caracteres. Si la password de tu cuenta
se compromete, puedes revocar la App Password sin cambiar tu password principal.

---

## 4. Manejo de Errores

### Fail-Fast Pattern

Si algo esta mal configurado, la app debe fallar **inmediatamente** al arrancar,
no 3 horas despues cuando el CRON ejecuta.

```typescript
// requireEnv lanza un error con mensaje claro si la variable no existe.
// El dev sabe EXACTAMENTE que falta, sin tener que debuggear.
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variable "${key}" es requerida pero no esta definida.`);
  }
  return value;
};
```

### Error Handling en capas

Este proyecto tiene 3 capas de resiliencia, de mas interna a mas externa:

1. **Promise.allSettled** (printer.service.ts): Si una impresora falla, las demas
   siguen. No lanzamos excepcion — separamos exitos de errores y dejamos que
   la capa superior decida.

2. **withRetry** (index.ts): Si el pipeline completo falla, se reintenta N veces.
   Cubre fallos transitorios (red intermitente, SMTP timeout).

3. **sendErrorNotification** (mail.service.ts): Si TODOS los reintentos fallan,
   se envia un correo a los admins con el detalle del error. Ultima linea de
   defensa antes de que el fallo pase desapercibido.

### El anti-patron: swallow errors

```typescript
// MAL — el error desaparece, nadie se entera
try { await doSomething(); } catch { }

// BIEN — loggeamos y notificamos
try {
  await doSomething();
} catch (error) {
  console.error(error);
  await sendErrorNotification(error);
}
```

---

## 5. Estructura de Proyecto

### Por que separar en carpetas

Un archivo `index.js` de 500 lineas funciona, pero:
- No escala. Cada cambio requiere navegar un archivo enorme.
- No permite trabajo paralelo (dos devs editando el mismo archivo = conflictos).
- No es testeable (no puedes testear el servicio de PDF sin cargar el de email).

### Patron por responsabilidad

```
src/
├── config/      Que valores usa la app (constantes, env vars)
├── types/       Que forma tienen los datos (contratos)
├── services/    Que hace la app (logica de negocio)
├── utils/       Funciones auxiliares reutilizables
└── index.ts     Como se orquesta todo (entry point)
```

Cada carpeta responde a una pregunta diferente. Si necesitas agregar una
nueva impresora, vas a `config/`. Si el PDF se ve mal, vas a `services/pdf.service.ts`.
No tienes que buscar en todo el proyecto.

### Single Source of Truth

Los tipos viven en UN SOLO lugar (`types/index.ts`). Si necesitas cambiar
la estructura de `PrinterResult`, lo cambias ahi y TypeScript te muestra
todos los archivos afectados. Sin tipos centralizados, tendrías tipos
duplicados o incoherentes entre archivos.

---

## 6. CRON Jobs

### Que es CRON

Un CRON job es una tarea programada que se ejecuta automaticamente segun
un horario. La expresion CRON define ese horario en 5 campos:

```
  minuto  hora  dia-del-mes  mes  dia-de-la-semana
     0      8     28-31       *         *
```

Esto significa: "a las 8:00 AM, los dias 28 al 31 de cada mes, cualquier mes,
cualquier dia de la semana".

### node-cron vs crontab del sistema

- **crontab** (Linux/Mac): Es parte del sistema operativo. No existe en Windows.
  Requiere configuracion del servidor.
- **node-cron**: Corre dentro de Node.js. Funciona en cualquier OS. Se configura
  en codigo. La desventaja: si el proceso de Node.js muere, el CRON muere con el.

Para produccion, lo ideal es que el proceso de Node corra como un **servicio**
(systemd en Linux, pm2, o un container en Docker) para que se reinicie
automaticamente si muere.

### Timezone

SIEMPRE especifica el timezone de tu CRON. Sin timezone, node-cron usa la zona
horaria del servidor. Si tu servidor esta en AWS us-east-1 (UTC-5), tu
"8 AM" seria las 3 AM en Mexico. Con `timezone: 'America/Mexico_City'`,
el CRON siempre ejecuta en hora local de Mexico sin importar donde corra.

---

## 7. Tecnologias y Decisiones

### SNMP (Simple Network Management Protocol)

Protocolo estandar para consultar dispositivos de red. Cada dato del
dispositivo (serial, contador, toner, estado) tiene un OID unico
(Object Identifier), que es como su "direccion" en el dispositivo.

Los OIDs que usamos son especificos de Ricoh. Si agregas una HP o Canon,
necesitarás buscar sus OIDs en la documentacion MIB del fabricante.

### pdf-lib vs pdfkit

El proyecto usa `pdf-lib` porque puede LEER un PDF existente (el template)
y escribir encima. `pdfkit` solo puede CREAR PDFs desde cero. Cuando tienes
un template con logo, formato y layout ya definido, pdf-lib es la mejor opcion.

### nodemailer

Libreria estandar de Node.js para envio de correos. Soporta SMTP, OAuth2,
attachments, HTML, y basicamente cualquier necesidad de email.

Tip: Gmail requiere App Password (no tu password normal) y tiene un limite
de ~500 correos/dia para cuentas gratuitas.

### dotenv

Carga variables del archivo `.env` al `process.env` de Node.js. Sin dotenv,
tendrias que configurar las variables a nivel del sistema operativo o
pasarlas en el comando (`SMTP_HOST=x node index.js`).

---

## 8. type vs interface

En este proyecto usamos `type` exclusivamente. Aqui la comparacion:

```typescript
// type — Functional Programming style
type Printer = {
  readonly name: string;
  readonly ip: string;
};

// interface — OOP style
interface Printer {
  readonly name: string;
  readonly ip: string;
}
```

Diferencias clave:
- `type` soporta unions (`type Status = 'ok' | 'error'`), intersections,
  mapped types. Es mas versatil.
- `interface` soporta `extends` (herencia) y declaration merging
  (agregar propiedades a una interface desde otro archivo). Son features de OOP.
- En un proyecto 100% FP, `type` es la eleccion natural porque no necesitamos
  herencia ni declaration merging.

La recomendacion oficial de TypeScript es: usa `interface` para APIs publicas
que otros consumiran (declaration merging es util), y `type` para todo lo demas.
En este proyecto no exponemos APIs publicas, asi que `type` es suficiente.

---

## 9. Checklist de Seguridad

Antes de cada deploy o merge, verifica:

- [ ] `.env` NO esta en el commit (`git status` no lo muestra)
- [ ] `.gitignore` incluye `.env`, `node_modules/`, `dist/`, `output/`
- [ ] No hay passwords, tokens o API keys hardcodeados en el codigo
- [ ] No hay `console.log` que imprima credenciales o datos sensibles
- [ ] Las App Passwords de Gmail son unicas por servicio (no reutilizar)
- [ ] El CRON tiene timezone explicito (no depende de config del servidor)
- [ ] Los `requireEnv()` cubren todas las variables criticas (SMTP, mail)
- [ ] El sistema de notificacion de errores funciona (probar con `npm run once`)

---

## 10. Comandos Utiles de Referencia

```bash
# Ejecutar el pipeline una vez (sin CRON, sin proceso persistente)
npm run once

# Desarrollo con CRON activo
npm run dev

# Desarrollo con ejecucion inmediata + CRON
npm run dev:run

# Verificar tipos sin compilar
npm run typecheck

# Build para produccion
npm run build
npm start

# Ver que archivos cambiaste
git status

# Ver los cambios detallados antes de commitear
git diff

# Ver el historial de commits
git log --oneline -10
```

---

## Resumen

| Concepto | Lo que aprendimos |
|---|---|
| TypeScript Strict | Nunca arrancar un proyecto sin `strict: true`. Es mas facil desde el inicio que despues. |
| Functional Programming | Funciones puras, inmutabilidad, composicion. Ideal para pipelines de datos. |
| Seguridad | `.env` + `.gitignore` desde el dia 1. Nunca hardcodear secretos. Rotar si se leakean. |
| Error Handling | Capas: partial failures -> retry -> notificacion. Nunca swallow errors. |
| Estructura | Separar por responsabilidad. Single Source of Truth para tipos. |
| CRON | Siempre con timezone explicito. node-cron para portabilidad cross-OS. |
| type vs interface | `type` para FP, `interface` para OOP. Elegir segun el paradigma del proyecto. |
