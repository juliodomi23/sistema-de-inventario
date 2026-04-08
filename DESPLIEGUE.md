# Guía de Despliegue — Sistema de Inventario y POS
> EasyPanel con Docker Compose

---

## Requisitos previos

- Servidor con EasyPanel instalado
- Git instalado en el servidor (o acceso por repositorio remoto)
- Dominio apuntando al servidor (opcional pero recomendado)

---

## Paso 1 — Generar el JWT Secret

En cualquier terminal con Python instalado:

```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

Copia el resultado. Lo necesitarás en el Paso 3.

---

## Paso 2 — Subir el proyecto a un repositorio Git

Si aún no tienes el proyecto en GitHub/GitLab:

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
5. Conecta tu repositorio Git o pega el contenido del `docker-compose.yml`

---

## Paso 4 — Configurar variables de entorno del backend

En EasyPanel, dentro del servicio `backend`, ve a **Environment**:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | El string generado en el Paso 1 |
| `DB_NAME` | `inventario` (o el nombre que prefieras) |
| `ADMIN_EMAIL` | Email del administrador |
| `ADMIN_PASSWORD` | Contraseña segura para el admin (mín. 8 chars) |
| `VENDEDOR_EMAIL` | Email del vendedor inicial |
| `VENDEDOR_PASSWORD` | Contraseña segura para el vendedor |
| `ALLOWED_ORIGINS` | URL pública del frontend (ej. `https://inventario.tudominio.com`) |
| `ENVIRONMENT` | `production` |

> ⚠️ **IMPORTANTE:** `ADMIN_PASSWORD` y `VENDEDOR_PASSWORD` deben ser contraseñas seguras, no `admin123`. El sistema crea estos usuarios automáticamente al arrancar si no existen.

---

## Paso 5 — Configurar el build arg del frontend

En EasyPanel, dentro del servicio `frontend`, ve a **Build Arguments**:

| Build Arg | Valor |
|---|---|
| `REACT_APP_BACKEND_URL` | URL pública del backend (ej. `https://api.inventario.tudominio.com`) |

> Esta URL se incrusta en el build de React. Si la cambias, necesitas hacer rebuild del frontend.

---

## Paso 6 — Configurar dominios

En EasyPanel, para cada servicio configura el dominio:

- **frontend** → `inventario.tudominio.com` (puerto 80)
- **backend** → `api.inventario.tudominio.com` (puerto 8000) — opcional si usas el proxy de nginx

> Si prefieres usar un solo dominio, el `nginx.conf` del frontend ya hace proxy de `/api/` al backend interno. En ese caso solo necesitas exponer el frontend y no necesitas dominio público para el backend.

**Configuración con un solo dominio (recomendado):**
- **frontend** → `inventario.tudominio.com` (puerto 80)
- El backend NO necesita dominio público, solo está en la red interna de Docker
- En `REACT_APP_BACKEND_URL` puedes dejar vacío (el nginx lo maneja internamente)

---

## Paso 7 — Primer deploy

1. En EasyPanel haz clic en **Deploy**
2. Espera que los tres servicios estén en verde: `mongo`, `backend`, `frontend`
3. Verifica el health del backend:
   ```
   GET https://api.inventario.tudominio.com/api/health
   ```
   Debe responder: `{"status": "ok", "db": "connected"}`

---

## Paso 8 — Primer acceso

Al arrancar por primera vez, el backend crea automáticamente:
- El usuario admin con las credenciales de `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- El usuario vendedor con las credenciales de `VENDEDOR_EMAIL` / `VENDEDOR_PASSWORD`

Entra a `https://inventario.tudominio.com` e inicia sesión como admin.

---

## Paso 9 — Crear usuarios adicionales

El registro público está desactivado. Los usuarios se crean desde el panel:

1. Inicia sesión como admin
2. Ve a **Usuarios** en el menú
3. Haz clic en **Nuevo Usuario**
4. Llena nombre, email, contraseña y rol (`admin` o `vendedor`)

---

## Actualizaciones futuras

Para actualizar el sistema con nuevos cambios de código:

1. Haz push de los cambios al repositorio
2. En EasyPanel → **Deploy** (o activa auto-deploy desde el repo)

> Si cambiaste variables de entorno del backend, solo necesitas reiniciar ese servicio. Si cambiaste `REACT_APP_BACKEND_URL`, necesitas rebuild del frontend.

---

## Solución de problemas

**El backend no arranca:**
- Verifica que `JWT_SECRET` esté configurado en las variables de entorno
- Revisa los logs en EasyPanel → servicio `backend` → **Logs**

**El frontend no conecta con el backend:**
- Verifica que `ALLOWED_ORIGINS` en el backend incluya la URL exacta del frontend (con https, sin barra final)
- Si usas un solo dominio, verifica que `nginx.conf` esté en `frontend/nginx.conf`

**La base de datos no persiste entre reinicios:**
- El volumen `mongo_data` en `docker-compose.yml` persiste los datos automáticamente en EasyPanel

**Error 403 en endpoints:**
- Asegúrate de que el usuario tenga el rol correcto (`admin` o `vendedor`)
- Verifica que estés autenticado (cookie de sesión activa)
