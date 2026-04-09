# Guía de Despliegue — Sistema de Inventario y POS
> EasyPanel con Docker Compose

---

## Requisitos previos

- Servidor con EasyPanel instalado
- Repositorio Git (GitHub, GitLab, etc.)
- Dominio apuntando al servidor (opcional pero recomendado)

---

## Paso 1 — Generar el JWT Secret

En cualquier terminal con Python instalado:

```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

Copia el resultado. Lo necesitarás en el Paso 4.

---

## Paso 2 — Subir el proyecto a un repositorio Git

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

---

## Paso 3 — Crear el proyecto en EasyPanel

1. Entra a EasyPanel → **Projects** → **New Project**
2. Dale un nombre (ej. `inventario-cliente`)
3. Dentro del proyecto → **+ New Service** → **App**
4. Selecciona **Docker Compose**
5. Conecta tu repositorio Git

---

## Paso 4 — Configurar variables de entorno

En EasyPanel, en la sección **Environment** del proyecto o del servicio correspondiente, agrega todas estas variables:

| Variable | Dónde | Valor |
|---|---|---|
| `JWT_SECRET` | backend | El string generado en el Paso 1 |
| `DB_NAME` | backend | `inventario` |
| `ADMIN_EMAIL` | backend | Email del administrador |
| `ADMIN_PASSWORD` | backend | Contraseña segura (mín. 8 chars) |
| `VENDEDOR_EMAIL` | backend | Email del vendedor inicial |
| `VENDEDOR_PASSWORD` | backend | Contraseña segura (mín. 8 chars) |
| `ALLOWED_ORIGINS` | backend | URL pública del frontend (ej. `https://inventario.tudominio.com`) |
| `REACT_APP_BACKEND_URL` | frontend | URL pública del frontend (la misma, ej. `https://inventario.tudominio.com`) |

> ⚠️ `ADMIN_PASSWORD` y `VENDEDOR_PASSWORD` deben ser contraseñas seguras. El sistema crea estos usuarios automáticamente al arrancar por primera vez.

> ℹ️ `REACT_APP_BACKEND_URL` se configura como variable de entorno normal en EasyPanel (no como build arg). El `docker-compose.yml` la toma automáticamente con `${REACT_APP_BACKEND_URL}` y la pasa al build de React.

> ℹ️ `REACT_APP_BACKEND_URL` y `ALLOWED_ORIGINS` apuntan a la **URL del frontend** porque nginx hace el proxy de `/api/` al backend internamente — no necesitas exponer el backend al exterior.

---

## Paso 5 — Configurar el dominio y puerto del frontend

En EasyPanel, dentro del servicio `frontend`:

1. Ve a **Domains**
2. Agrega tu dominio (ej. `inventario.tudominio.com`)
3. En el campo **Port** pon `80`

El backend y mongo **no necesitan dominio público** — nginx los conecta internamente.

---

## Paso 6 — Deploy

1. Haz clic en **Deploy**
2. Espera que los tres servicios estén en verde: `mongo`, `backend`, `frontend`
3. Verifica que el backend responde abriendo en el navegador:
   ```
   https://inventario.tudominio.com/api/health
   ```
   Debe responder: `{"status": "ok", "db": "connected"}`

---

## Paso 7 — Primer acceso

Al arrancar por primera vez el backend crea automáticamente el admin y el vendedor con las credenciales que configuraste.

Entra a `https://inventario.tudominio.com` e inicia sesión como admin.

---

## Paso 8 — Crear usuarios adicionales

El registro público está desactivado. Los usuarios se crean desde el panel:

1. Inicia sesión como admin
2. Ve a **Usuarios** en el menú
3. Haz clic en **Nuevo Usuario**
4. Llena nombre, email, contraseña y rol (`admin` o `vendedor`)

---

## Actualizaciones futuras

1. Haz push de los cambios al repositorio
2. En EasyPanel → **Deploy**

> Si cambiaste variables de entorno del backend, solo reinicia ese servicio. Si cambiaste `REACT_APP_BACKEND_URL`, necesitas rebuild completo del frontend.

---

## Solución de problemas

**"Servicio no se puede alcanzar" en el frontend:**
- Ve al servicio `frontend` → **Domains** → verifica que el puerto sea `80`

**`REACT_APP_BACKEND_URL no está definida`:**
- Asegúrate de haber agregado `REACT_APP_BACKEND_URL` en las variables de entorno de EasyPanel
- Haz rebuild completo (es una variable de build time, se incrusta en el bundle de React)

**El backend no arranca:**
- Verifica que `JWT_SECRET` esté configurado
- Revisa los logs: EasyPanel → servicio `backend` → **Logs**

**Error de CORS en el navegador:**
- Verifica que `ALLOWED_ORIGINS` tenga la URL exacta del frontend (con `https://`, sin `/` al final)

**La base de datos no persiste entre reinicios:**
- El volumen `mongo_data` en `docker-compose.yml` persiste los datos automáticamente

**Error 403 en endpoints:**
- Asegúrate de que el usuario tenga el rol correcto (`admin` o `vendedor`)
- Verifica que estés autenticado (la sesión no haya expirado)
