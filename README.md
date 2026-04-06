```
◈ ─────────────────────────────────────────────────────────── ◈
  P R E S U P  —  Tracker de Gastos Mensuales
◈ ─────────────────────────────────────────────────────────── ◈
```

> App personal para registrar ingresos y gastos mes a mes, con soporte para **pesos y dólares**, analítica histórica, gastos fijos recurrentes y sincronización con **Google Drive**.

---

## ✦ Funcionalidades

### Carga mensual

| Paso | Sección | Descripción |
|:----:|---------|-------------|
| `↑` | **Ingresos** | Pesos, dólares y cotización USD opcional |
| `▣` | **Tarjetas** | Múltiples tarjetas con banco, red, gastos en $ y USD |
| `⌂` | **Alquiler** | Monto mensual en pesos |
| `≡` | **Otros gastos** | Items libres con descripción, monto, moneda y nota opcional |
| `◈` | **Reporte** | Resumen con totales, balance y alertas de gastos fijos |

**Flujo de edición de un mes ya registrado**

```
Hoy — cargo tarjeta 1 + sueldo  →  guarda en historial
Mañana — llega tarjeta 2        →  "Cargar y editar" el mismo mes
                                →  agrega la tarjeta nueva
                                →  guarda  →  historial y Drive se actualizan
Mes pasado — gasto olvidado     →  Historial → "✎ Editar mes" → agrega → guarda
```

### Otras funciones

| Módulo | Descripción |
|--------|-------------|
| **Editar mes existente** | Carga un mes ya guardado en el formulario para seguir completando |
| **Copiar último mes** | Pre-rellena el formulario con los datos del mes anterior |
| **Presupuesto mensual** | Límite de gastos con barra de progreso y alerta de desvío |
| **Gastos fijos** | Alta de recurrentes con historial de precios; se incluyen solos en cada mes |
| **Historial** | Archivo completo con detalle, descarga CSV individual y borrado |
| **Exportar todo** | Un CSV consolidado con todos los meses |
| **Analítica** | Tendencias 6 meses, promedios, tasa de ahorro, top 6 categorías |
| **Año vs año** | Comparativa del mes actual contra el mismo mes del año anterior |
| **Google Drive** | Sync automático — un archivo CSV por mes, actualización sin duplicar |

---

## 🏗 Arquitectura

```
presup/
├── index.html                   ← carga Google Identity Services y Drive API
├── vite.config.js               ← Vite + React + config de Vitest
├── .env.example                 ← variables de entorno requeridas
│
└── src/
    ├── main.jsx                 ← entry point React
    ├── App.jsx                  ← orquestador principal
    │                               · estado global del formulario
    │                               · wizard de 5 pasos (0–4)
    │                               · carga/edición de mes existente
    │                               · persistencia localStorage
    │                               · coordinación Drive
    │
    ├── logic.js                 ← lógica de negocio pura (testeable)
    │                               · validateCards()
    │                               · filterCards()
    │                               · mapCardsFromReport()
    │                               · mapOthersFromReport()
    │
    ├── constants.js             ← paleta de colores, estilos compartidos,
    │                               config Google Drive, definición de STEPS
    │
    ├── utils.js                 ← helpers sin dependencias de UI
    │                               · fmt / fmtP / fmtD — formateo de moneda
    │                               · getCurrentMonth / monthLabel / monthShort
    │                               · getActiveFixed — gastos fijos por mes
    │                               · buildCSV / parseReportFromCSV — serialización
    │                               · mergeHistory — merge local + Drive sin duplicados
    │                               · computeAnalytics — engine de analítica
    │                               · LS — wrapper de localStorage con try/catch
    │
    ├── hooks/
    │   └── useDrive.js          ← Google Drive completo
    │                               · OAuth 2.0 con Google Identity Services
    │                               · syncHistory — descarga y parsea todos los CSV
    │                               · uploadCSV — crea o actualiza el archivo del mes
    │                               · deleteFile — borrado en Drive
    │                               · estados: idle | loading | connected | error
    │
    ├── components/
    │   ├── App.jsx (host)
    │   ├── ReportView.jsx       ← detalle de un reporte mensual (tarjetas, totales,
    │   │                           presupuesto, gastos fijos con delta %)
    │   ├── FixedExpensesView.jsx← ABM de gastos fijos + historial de precios
    │   ├── AnalyticsView.jsx    ← dashboard: gráficos, YoY, fijos, top categorías
    │   ├── BarChart.jsx         ← gráfico SVG de barras (6 meses, ingresos vs gastos)
    │   ├── DonutChart.jsx       ← gráfico SVG de torta (top 6 categorías de gasto)
    │   ├── DriveButton.jsx      ← botón de conexión con estado visual de Drive
    │   └── ConfirmDialog.jsx    ← modal de confirmación de borrado
    │
    └── logic.test.js            ← tests unitarios con Vitest
```

---

## 🔄 Flujo de datos

```
┌─────────────────────────────────────────────────────────────┐
│                         App.jsx                             │
│                                                             │
│  formulario  ──→  validate()  ──→  buildReport()           │
│  (5 pasos)                             │                    │
│                                        ▼                    │
│                                   persist()  ──→  LS       │
│                                        │                    │
│                                        ▼                    │
│                                   saveToDrive()  ──→  ☁    │
└─────────────────────────────────────────────────────────────┘

 editar mes existente:
   historial / banner  ──→  loadFromReport()  ──→  formulario pre-cargado
                                                        │
                                                        ▼
                                                   guardar  →  reemplaza
                                                              el mes en
                                                              historial y Drive
```

---

## 💾 Persistencia

### localStorage

| Clave | Contenido |
|-------|-----------|
| `presup:history` | Array de reportes mensuales completos |
| `presup:fixedExpenses` | Array de gastos fijos con `priceHistory[]` |
| `presup:budget` | Presupuesto mensual en pesos (string) |

### Google Drive

- Un archivo por mes: `presupuesto_YYYY-MM.csv`
- Carpeta fija: `DRIVE_FOLDER_ID` en `constants.js`
- Al editar un mes ya sincronizado, el archivo existente se **actualiza** (no se duplica)
- Scope mínimo: `drive.file` — solo ve los archivos creados por la app

### Formato CSV

```
"PRESUP — Reporte mensual"
"Mes","Abril 2025"
...tabla legible (compatible con Excel / Google Sheets)...

##PRESUP_DATA##
{"month":"2025-04","income":{...},"cards":[...],...}
##PRESUP_DATA##
```

La sección `##PRESUP_DATA##` embebe el JSON completo para reimportación exacta.

---

## 🧪 Tests

```bash
npm test
```

Tests unitarios en `src/logic.test.js` (Vitest, sin DOM):

| Suite | Qué valida |
|-------|-----------|
| `validateCards` | Nombre requerido solo si hay monto; tarjeta vacía no bloquea |
| `filterCards` | Excluye filas sin banco ni montos; convierte strings a números |
| `mapCardsFromReport` | Montos `0` → string vacío; ids secuenciales; preserva banco y red |
| `mapOthersFromReport` | Filtra vacíos; convierte monto; preserva moneda y notas |

---

## 🚀 Deploy

### 1 — Subir a GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/presup.git
git push -u origin main
```

### 2 — Deploy en Vercel (gratis)

1. Entrá a **vercel.com** e iniciá sesión con GitHub
2. **Add New Project** → importá el repo
3. Vercel detecta Vite automáticamente → **Deploy**

> La app funciona completa sin Drive. El paso siguiente es opcional.

### 3 — Configurar Google Drive

<details>
<summary>Ver pasos detallados</summary>

#### 3a. Crear proyecto en Google Cloud Console

1. Andá a [console.cloud.google.com](https://console.cloud.google.com)
2. **Selector de proyectos → Nuevo proyecto** → nombre: `presup`

#### 3b. Habilitar Google Drive API

1. **APIs y Servicios → Biblioteca**
2. Buscá **"Google Drive API"** → Habilitar

#### 3c. Pantalla de consentimiento OAuth

1. **APIs y Servicios → Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo** → Crear
3. Completá nombre de la app y email de soporte
4. En **"Usuarios de prueba"**: agregá tu Gmail

#### 3d. Crear credenciales OAuth

1. **Credenciales → + Crear credenciales → ID de cliente OAuth**
2. Tipo: **Aplicación web** / Nombre: `presup-web`
3. En **Orígenes autorizados** agregá:
   ```
   https://presup-xxx.vercel.app
   http://localhost:5173
   ```
4. Copiá el **ID de cliente** generado

#### 3e. Agregar el Client ID en Vercel

1. Proyecto en Vercel → **Settings → Environment Variables**
2. Nombre: `VITE_GOOGLE_CLIENT_ID` / Valor: el ID copiado
3. **Redeploy**

</details>

---

## 🛠 Desarrollo local

```bash
npm install
cp .env.example .env
# editá .env con tu VITE_GOOGLE_CLIENT_ID
npm run dev      # http://localhost:5173
npm test         # corre los tests unitarios
```

---

## ⚙ Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 |
| Build | Vite 5 |
| Estilos | CSS-in-JS inline (sin framework externo) |
| Auth | Google Identity Services (OAuth 2.0 implícito) |
| Storage | `localStorage` + Google Drive API v3 |
| Tests | Vitest |
| Deploy | Vercel |

---

```
◈ ─────────────────────────────────────────────────────────── ◈
```
