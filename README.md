# CollabSpace - Votaciones & Kanban

Aplicación web moderna y colaborativa diseñada con una estética visual premium (Glassmorphism, Dark Mode y micro-animaciones). Cuenta con un sistema de usuarios (hasta 30 usuarios), un módulo de votaciones (con soporte para voto único y voto múltiple con visualización de resultados en tiempo real) y un tablero Kanban interactivo (con soporte Drag & Drop y botones táctiles/móviles).

Esta versión de desarrollo utiliza **Express** en el backend y **SQLite** de forma local para facilitar pruebas rápidas sin configuraciones complejas de red.

---

## 🚀 Requisitos e Instalación

Para ejecutar la aplicación en tu máquina local, necesitarás tener instalado **Node.js** (versión 16 o superior).

1. Abre tu terminal en la raíz del proyecto (`crist27`).
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
3. Inicia la aplicación:
   ```bash
   npm start
   ```
4. Abre tu navegador e ingresa a [http://localhost:3000](http://localhost:3000).

---

## 🔑 Credenciales de Prueba por Defecto

La base de datos SQLite se inicializará automáticamente en el primer arranque con los siguientes usuarios de demostración:

*   **Administrador:**
    *   **Usuario:** `admin`
    *   **Contraseña:** `admin123`
    *   *(Permiso especial: Puede crear nuevas encuestas).*
*   **Usuario Estándar:**
    *   **Usuario:** `user`
    *   **Contraseña:** `user123`
    *   *(Permisos: Votar y crear/mover tareas en el Kanban).*

*Nota: También puedes registrar nuevos usuarios directamente desde la pantalla de bienvenida (hasta un máximo de 30).*

---

## 📁 Estructura del Proyecto

*   `package.json`: Configura las dependencias del proyecto (`express`, `sqlite3`, `bcryptjs`, `cors`).
*   `server.js`: El servidor Express que define la API REST y sirve la carpeta `public`.
*   `database.js`: Abstracción de base de datos SQLite. Aquí se crean las tablas y se exponen las consultas.
*   `public/`: Código fuente del cliente frontend.
    *   `index.html`: Estructura HTML5 de la aplicación Single Page Application (SPA).
    *   `styles.css`: Estilos visuales modernos, animaciones suaves y variables de diseño.
    *   `app.js`: Manejo del estado, comunicación con la API REST y comportamiento Drag & Drop.

---

## ⚡ Guía de Migración a Supabase

Cuando estés listo para desplegar en producción y utilizar **Supabase** como base de datos en la nube gratuita, sigue estos pasos:

### 1. Crear el Proyecto en Supabase
1. Ve a [Supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto.

### 2. Ejecutar el Script SQL
Ve a la sección **SQL Editor** en tu panel de Supabase y ejecuta las siguientes consultas para recrear la base de datos:

```sql
-- Tabla de Usuarios
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
);

-- Tabla de Encuestas
CREATE TABLE polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('single', 'multiple')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Opciones de Encuesta
CREATE TABLE poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL
);

-- Votos de los usuarios
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  UNIQUE(poll_id, user_id, option_id)
);

-- Tareas del Kanban
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration TEXT,
  importance TEXT NOT NULL CHECK(importance IN ('low', 'medium', 'high')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

### 3. Modificar la Conexión en el Código
Para adaptar tu backend a Supabase en lugar de SQLite:
1. Instala el cliente de Supabase en tu backend:
   ```bash
   npm install @supabase/supabase-js dotenv
   ```
2. Crea un archivo `.env` en la raíz con tus claves:
   ```env
   SUPABASE_URL=tu_supabase_url
   SUPABASE_KEY=tu_supabase_anon_key
   ```
3. Reemplaza `database.js` para usar `@supabase/supabase-js` para realizar las operaciones CRUD. Al encapsular las consultas en funciones como `createUser` u `getPollsWithResults`, solo tendrás que reescribir esas funciones específicas sin alterar `server.js` ni `app.js`.

---

## 🌐 Hosting y Despliegue

### Despliegue en Render / Railway / Vercel (Recomendado para Full Stack)
Dado que la aplicación cuenta con un servidor backend dinámico, el hosting estático como GitHub Pages requeriría migrar el frontend a consumir una API independiente y utilizar funciones Serverless. Para desplegar de forma íntegra con un solo comando:
1. Sube el repositorio a GitHub.
2. Conecta el repositorio a **Render.com** o **Railway.app** como un *Web Service*.
3. Render detectará automáticamente el script `npm start` y desplegará la app en segundos.
