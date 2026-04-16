```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ◈  P R E S U P                                             ║
║      Tracker de Gastos Mensuales                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

App personal para registrar ingresos y gastos mes a mes, con soporte **pesos y dólares**, gastos fijos recurrentes con historial de precios, analítica histórica y sincronización con **Google Drive** en formato **Excel multi-hoja**.

---

## ✦ Funcionalidades

### Carga mensual — wizard de 5 pasos

```
  ↑ INGRESOS   ▣ TARJETAS   ⌂ ALQUILER   ≡ GASTOS   ◈ REPORTE
  ───────────────────────────────────────────────────────────────
  Pesos        Múltiples     Monto en     Items con   Balance,
  Dólares      tarjetas      pesos        categoría,  alertas,
  Cotización   Banco/Red                  monto,      fijos
  USD          $  y  USD                  moneda,     auto-
  Presupuesto                             nota        incluidos
```

### Gastos fijos

- **Alta** con descripción, monto y moneda
- **Historial de precios**: al actualizar el precio se registra el mes de cambio
- El precio correcto se calcula automáticamente por mes (sin tocar reportes ya guardados)
- Se incluyen solos en cada nuevo mes
- Al eliminar, el gasto sigue activo el mes actual y desaparece desde el siguiente
- La tab **Fijos** muestra activos, historial de precios e inactivos

### Analítica

| Métrica | Descripción |
|---------|-------------|
| **KPIs** | Prom. gastos, prom. ingreso, meses positivos, tasa de ahorro |
| **Ingreso comprometido** | % del ingreso que va a fijos + alquiler, con barra visual y umbral de color |
| **Presupuesto mensual** | Adherencia histórica mes a mes |
| **Mes vs mes anterior** | Variación % de gastos e ingresos |
| **Año vs año** | Mismo mes comparado contra el año anterior |
| **Tendencia 6 meses** | Gráfico de barras ingresos / gastos / balance |
| **Gastos fijos** | Total, variación vs mes anterior, cambios de precio individuales (%), evolución 6 meses |
| **Top categorías** | Top 6 acumulado histórico (grupos por categoría de Otros Gastos) |

### Categorías en Otros Gastos

Cada ítem de "Otros Gastos" lleva una categoría para que la analítica agregue correctamente:

`Alimentación` · `Transporte` · `Salud` · `Entretenimiento` · `Ropa` · `Educación` · `Servicios` · `Mascotas` · `Otros`

### Otras funciones

| Función | Descripción |
|---------|-------------|
| **Cargar y editar** | Abre un mes ya guardado en el formulario |
| **Copiar último mes** | Pre-rellena tarjetas, alquiler y otros del mes anterior |
| **Historial** | Lista completa con detalle, edición, descarga y borrado |
| **Exportar todo** | Un Excel con el historial resumido de todos los meses |
| **Google Drive** | Sync automático — un `.xlsx` por mes, actualiza sin duplicar |

---

## 📊 Exportación Excel (multi-hoja)

Cada archivo `presupuesto_YYYY-MM.xlsx` contiene una hoja por sección:

```
  presupuesto_2026-04.xlsx
  │
  ├── Resumen        ← mes, cotización, presupuesto, totales, balance, estado
  ├── Ingresos       ← pesos y dólares
  ├── Tarjetas       ← banco, red, gastos $ y USD  (solo si hay)
  ├── Alquiler       ← monto                        (solo si > 0)
  ├── Gastos Fijos   ← descripción, moneda, monto   (solo si hay)
  ├── Otros Gastos   ← descripción, categoría, moneda, monto, notas
  ├── Analítica      ← KPIs, tendencia, cambios en fijos
  └── _JSON          ← JSON embebido para reimportación desde Drive
```

> **"Exportar todo"** genera un único Excel con hoja `Historial` (una fila por mes, todos los períodos).

---

## 🔄 Flujo de datos

```
  ┌──────────────────────────────────────────────────────────┐
  │                        App.jsx                           │
  │                                                          │
  │  formulario  ──→  validate()  ──→  buildReport()        │
  │  (5 pasos)                              │                │
  │                                         ▼                │
  │                                    persist()  ──→  LS   │
  │                                         │                │
  │                                         ▼                │
  │                                    saveToDrive() ──→  ☁ │
  └──────────────────────────────────────────────────────────┘

  editar mes existente:
    historial  ──→  loadFromReport()  ──→  formulario pre-cargado
                                                │
                                                ▼
                                           guardar → reemplaza el mes
                                                     en historial y Drive
  gastos fijos:
    global fixedExpenses (LS)
         │
         └──→  getActiveFixed(fixedExpenses, month)
                    │  filtra por createdMonth ≤ month
                    │  y  deletedMonth ≥ month (activo hasta el mes de baja inclusive)
                    │  y  aplica getFixedAmountForMonth() via priceHistory[]
                    ▼
               se embeben en el reporte al guardar (snapshot inmutable)
```

---

## 🏗 Arquitectura

```
presup/
├── index.html                   ← carga Google Identity Services y Drive API
├── vite.config.js
├── .env.example
│
└── src/
    ├── main.jsx
    │
    ├── App.jsx                  ← orquestador principal
    │                               · estado global del formulario
    │                               · wizard 5 pasos (0–4)
    │                               · carga/edición de mes existente
    │                               · persistencia localStorage
    │                               · coordinación Drive
    │
    ├── constants.js             ← paleta, estilos compartidos,
    │                               EXPENSE_CATEGORIES, STEPS, config Drive
    │
    ├── logic.js                 ← lógica pura (testeable sin DOM)
    │                               · validateCards()
    │                               · filterCards()
    │                               · mapCardsFromReport()
    │                               · mapOthersFromReport()
    │
    ├── utils.js                 ← helpers sin dependencias de UI
    │                               · fmt / fmtP / fmtD
    │                               · getCurrentMonth / monthLabel / monthShort
    │                               · getActiveFixed(fixedExpenses, month)
    │                               · getFixedAmountForMonth(fe, month)
    │                               · parseReportFromCSV  (compat Drive legacy)
    │                               · mergeHistory
    │                               · computeAnalytics    (committed, committedRate, ...)
    │                               · LS — wrapper localStorage
    │
    ├── buildXLSX.js             ← generación y parseo de archivos Excel
    │                               · buildXLSX(report, analytics)  → workbook multi-hoja
    │                               · buildHistoryXLSX(history)     → historial consolidado
    │                               · workbookToBlob(wb)            → Blob descargable
    │                               · parseReportFromXLSX(buffer)   → reimportación Drive
    │
    ├── hooks/
    │   └── useDrive.js          ← Google Drive completo
    │                               · OAuth 2.0 (Google Identity Services)
    │                               · syncHistory — descarga .xlsx y .csv (legacy)
    │                               · uploadXLSX  — crea o actualiza el archivo del mes
    │                               · deleteFile
    │                               · estados: idle | loading | connected | error
    │
    ├── components/
    │   ├── ReportView.jsx       ← detalle mensual (tarjetas, fijos, categorías, balance)
    │   ├── FixedExpensesView.jsx← ABM de fijos + historial de precios + soft delete
    │   ├── AnalyticsView.jsx    ← dashboard: KPIs, ingreso comprometido, YoY, gráficos
    │   ├── BarChart.jsx         ← SVG barras (6 meses)
    │   ├── DonutChart.jsx       ← SVG torta (top categorías)
    │   ├── DriveButton.jsx      ← conexión Drive con estado visual
    │   └── ConfirmDialog.jsx    ← modal borrado
    │
    └── logic.test.js            ← tests unitarios Vitest
```

---

## 💾 Persistencia

### localStorage

| Clave | Contenido |
|-------|-----------|
| `presup:history` | Array de reportes mensuales (snapshots inmutables) |
| `presup:fixedExpenses` | Array de fijos con `priceHistory[]` y `deletedMonth` |
| `presup:budget` | Presupuesto mensual en pesos |

### Google Drive

- Archivo por mes: `presupuesto_YYYY-MM.xlsx`
- Carpeta fija: `DRIVE_FOLDER_ID` en `constants.js`
- Al editar un mes ya sincronizado el archivo se **actualiza** (no se duplica)
- Al migrar un `.csv` legacy, se reescribe como `.xlsx` actualizando también el MIME type
- Scope mínimo: `drive.file` — solo ve archivos creados por la app
- **Backward compat**: los `.csv` ya existentes en Drive siguen siendo leídos y parseados

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
| `mapCardsFromReport` | Montos `0` → string vacío; ids secuenciales; preserva banco/red |
| `mapOthersFromReport` | Filtra vacíos; convierte monto; preserva moneda, notas y categoría |

---

## 🚀 Deploy

### 1 — GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/presup.git
git push -u origin main
```

### 2 — Vercel (gratis)

1. [vercel.com](https://vercel.com) → **Add New Project** → importá el repo
2. Vercel detecta Vite automáticamente → **Deploy**

> La app funciona completa sin Drive. El paso siguiente es opcional.

### 3 — Google Drive (opcional)

<details>
<summary>Ver pasos detallados</summary>

#### 3a. Crear proyecto en Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com)
2. **Selector → Nuevo proyecto** → nombre: `presup`

#### 3b. Habilitar Google Drive API

1. **APIs y Servicios → Biblioteca**
2. **"Google Drive API"** → Habilitar

#### 3c. Pantalla de consentimiento OAuth

1. **APIs y Servicios → Pantalla de consentimiento → Externo** → Crear
2. Nombre de la app + email de soporte
3. **Usuarios de prueba** → agregá tu Gmail

#### 3d. Crear credenciales OAuth

1. **Credenciales → + Crear → ID de cliente OAuth**
2. Tipo: **Aplicación web**
3. **Orígenes autorizados**:
   ```
   https://TU-APP.vercel.app
   http://localhost:5173
   ```
4. Copiá el **ID de cliente**

#### 3e. Variable de entorno en Vercel

1. **Settings → Environment Variables**
2. `VITE_GOOGLE_CLIENT_ID` = el ID copiado
3. **Redeploy**

</details>

---

## 🛠 Desarrollo local

```bash
npm install
cp .env.example .env        # agregá tu VITE_GOOGLE_CLIENT_ID
npm run dev                 # http://localhost:5173
npm test                    # tests unitarios
```

---

## ⚙ Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 |
| Build | Vite 5 |
| Estilos | CSS-in-JS inline (sin framework externo) |
| Excel | SheetJS (xlsx) |
| Auth | Google Identity Services (OAuth 2.0) |
| Storage | `localStorage` + Google Drive API v3 |
| Tests | Vitest |
| Deploy | Vercel |

---

```
◈ ─────────────────────────────────────────────────────────── ◈
```
