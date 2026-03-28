# ◈ PRESUP — Tracker de Gastos Mensuales

App personal de seguimiento de gastos con soporte para pesos y dólares, analítica histórica y guardado en Google Drive.

---

## 🚀 Deploy en 3 pasos

### PASO 1 — Subir a GitHub

1. Creá un repositorio nuevo en github.com (ej: `presup`)
2. Desde tu terminal (o GitHub Desktop), ejecutá:

```bash
cd ruta/a/esta/carpeta
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/presup.git
git push -u origin main
```

---

### PASO 2 — Deploy en Vercel (gratis)

1. Entrá a **vercel.com** e iniciá sesión con tu cuenta de GitHub
2. Click en **"Add New Project"**
3. Buscá tu repo `presup` y hacé click en **"Import"**
4. Vercel detecta Vite automáticamente — no toques nada
5. Click en **"Deploy"** y esperá ~1 minuto
6. ✅ Tu app queda en una URL del tipo `https://presup-xxx.vercel.app`

> La app ya funciona en este punto. El siguiente paso es opcional pero necesario para que los CSV se guarden en Google Drive.

---

### PASO 3 — Configurar Google Drive (para guardar CSV en la nube)

#### 3a. Crear proyecto en Google Cloud Console

1. Andá a [console.cloud.google.com](https://console.cloud.google.com)
2. Click en el selector de proyectos (arriba a la izquierda) → **"Nuevo proyecto"**
3. Nombre: `presup` → **Crear**
4. Asegurate de tener el proyecto `presup` seleccionado

#### 3b. Habilitar la API de Google Drive

1. En el menú lateral: **APIs y Servicios → Biblioteca**
2. Buscá **"Google Drive API"**
3. Click en **"Habilitar"**

#### 3c. Crear pantalla de consentimiento OAuth

1. **APIs y Servicios → Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo** → Crear
3. Completá:
   - Nombre de la app: `PRESUP`
   - Email de asistencia: tu email
   - Email del desarrollador: tu email
4. Click en **Guardar y continuar** (saltá los demás pasos opcionales)
5. En **"Usuarios de prueba"**: agregá tu email de Gmail

#### 3d. Crear credenciales OAuth

1. **APIs y Servicios → Credenciales**
2. Click en **"+ Crear credenciales" → "ID de cliente OAuth"**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: `presup-web`
5. En **"Orígenes de JavaScript autorizados"**, agregá:
   ```
   https://presup-xxx.vercel.app
   ```
   *(reemplazá con tu URL real de Vercel)*
   
   También podés agregar para desarrollo local:
   ```
   http://localhost:5173
   ```
6. Click en **Crear**
7. 📋 **Copiá el "ID de cliente"** — es algo como `123456789-abc.apps.googleusercontent.com`

#### 3e. Agregar el Client ID en Vercel

1. En tu proyecto de Vercel → **Settings → Environment Variables**
2. Agregá:
   - **Name:** `VITE_GOOGLE_CLIENT_ID`
   - **Value:** el ID de cliente que copiaste
3. Click en **Save**
4. **Importante:** Redesployá tu proyecto (Settings → Deployments → Redeploy)

---

## ✅ Listo

Ahora en la app aparece el botón **"↑ Conectar Drive"** en el header.
Al presionarlo, Google pide permiso una sola vez y los CSVs se guardan automáticamente en tu carpeta de Drive.

---

## 🛠️ Desarrollo local

```bash
npm install
cp .env.example .env
# editá .env y ponés tu Client ID
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173)

---

## 📁 Estructura

```
presup/
├── src/
│   ├── App.jsx        # App completa
│   └── main.jsx       # Entry point React
├── index.html
├── vite.config.js
├── package.json
└── .env.example
```
