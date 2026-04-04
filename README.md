# ◈ PRESUP — Tracker de Gastos Mensuales

App personal de seguimiento de gastos con soporte para pesos y dólares, analítica histórica y sincronización con Google Drive.

---

## ✦ Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **Nuevo mes** | Wizard de 4 pasos: ingresos → tarjetas → alquiler → otros gastos |
| **Copiar último mes** | Pre-carga el formulario con los valores del mes anterior |
| **Notas por gasto** | Campo opcional de nota libre en cada gasto individual |
| **Presupuesto mensual** | Límite de gastos con barra de progreso y alerta de desvío |
| **Gastos fijos** | Alta y seguimiento de recurrentes con historial de precios |
| **Historial** | Archivo de meses anteriores con detalle y descarga CSV |
| **Exportar todo** | Descarga todo el historial en un único CSV consolidado |
| **Analítica** | Dashboard con tendencias, promedios, tasa de ahorro y top gastos |
| **Año vs año** | Comparativa del mes actual contra el mismo mes del año anterior |
| **Google Drive** | Sync automático de CSV por mes, carga y descarga desde la nube |

### Detalles
- Soporte completo para **pesos y dólares** con tipo de cambio opcional
- **Gastos fijos automáticos** — se incluyen solos en cada nuevo mes desde que fueron dados de alta
- **Historial de precios** en gastos fijos con delta % respecto al mes anterior
- Gráfico de barras de 6 meses (ingresos vs gastos) y gráfico de torta con top 6 categorías
- Persistencia local en `localStorage` + backup en Google Drive
- **CSV legible + JSON embebido** — editable en Excel sin romper la importación

---

## 🏗️ Arquitectura

```
src/
├── constants.js              # Paleta, config, estilos compartidos, STEPS
├── utils.js                  # Helpers, LS, CSV, analytics engine
├── hooks/
│   └── useDrive.js           # Google Drive OAuth + API hook
├── components/
│   ├── BarChart.jsx          # Gráfico de barras SVG (6 meses)
│   ├── DonutChart.jsx        # Gráfico de torta SVG (top gastos)
│   ├── DriveButton.jsx       # Estado y acción de conexión con Drive
│   ├── ConfirmDialog.jsx     # Modal de confirmación de borrado
│   ├── ReportView.jsx        # Detalle de reporte mensual + presupuesto
│   ├── FixedExpensesView.jsx # ABM de gastos fijos
│   └── AnalyticsView.jsx     # Dashboard con YoY, presupuesto y fijos
├── App.jsx                   # Routing, wizard del formulario, orquestación
└── main.jsx                  # Entry point React

index.html                    # Carga Google Identity Services y Drive API
vite.config.js                # Configuración Vite + React
.env.example                  # Variables de entorno requeridas
```

### Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 |
| Build | Vite 5 |
| Estilos | CSS-in-JS inline (sin framework) |
| Auth | Google Identity Services (OAuth 2.0) |
| Storage | localStorage + Google Drive API v3 |
| Deploy | Vercel |

### Persistencia

**localStorage:**
- `presup:history` — array de reportes mensuales
- `presup:fixedExpenses` — array de gastos fijos con historial de precios
- `presup:budget` — límite de presupuesto mensual en pesos

**Google Drive:**
- Un archivo por mes: `presupuesto_YYYY-MM.csv`
- Carpeta fija configurada en `constants.js`
- Scope limitado: `drive.file` (solo archivos creados por la app)

**Formato CSV:**
```
# sección legible (compatible con Excel/Sheets)
...tabla de datos...

##PRESUP_DATA##
{ ...JSON completo del reporte... }
##PRESUP_DATA##
```

---

## 🚀 Deploy en 3 pasos

### PASO 1 — Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/presup.git
git push -u origin main
```

---

### PASO 2 — Deploy en Vercel (gratis)

1. Entrá a **vercel.com** e iniciá sesión con GitHub
2. Click en **"Add New Project"** → importá tu repo
3. Vercel detecta Vite automáticamente — no toques nada
4. Click en **"Deploy"**

> La app ya funciona. El paso siguiente es opcional pero necesario para guardar en Drive.

---

### PASO 3 — Configurar Google Drive

#### 3a. Crear proyecto en Google Cloud Console

1. Andá a [console.cloud.google.com](https://console.cloud.google.com)
2. Selector de proyectos → **"Nuevo proyecto"** → nombre: `presup`

#### 3b. Habilitar la API de Google Drive

1. **APIs y Servicios → Biblioteca**
2. Buscá **"Google Drive API"** → **Habilitar**

#### 3c. Crear pantalla de consentimiento OAuth

1. **APIs y Servicios → Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo** → Crear
3. Completá nombre de la app y emails
4. En **"Usuarios de prueba"**: agregá tu email de Gmail

#### 3d. Crear credenciales OAuth

1. **APIs y Servicios → Credenciales → + Crear credenciales → ID de cliente OAuth**
2. Tipo: **Aplicación web** / Nombre: `presup-web`
3. En **"Orígenes de JavaScript autorizados"** agregá:
   ```
   https://presup-xxx.vercel.app
   http://localhost:5173
   ```
4. Copiá el **"ID de cliente"** generado

#### 3e. Agregar el Client ID en Vercel

1. Tu proyecto en Vercel → **Settings → Environment Variables**
2. Agregá `VITE_GOOGLE_CLIENT_ID` con el ID copiado
3. **Redeploy** el proyecto

---

## 🛠️ Desarrollo local

```bash
npm install
cp .env.example .env
# editá .env con tu Client ID
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173)
