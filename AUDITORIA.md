# Auditoría Completa — Sistema de Inventario y POS
> Fecha: 2026-04-08 | Auditado por: Frontend Engineer + Backend Architect + UI/UX Designer

---

## Resumen Ejecutivo

El sistema es un MVP funcional y bien estructurado, pero tiene **problemas críticos de seguridad** que deben resolverse antes de cualquier deploy a producción. La arquitectura actual soporta un solo negocio; convertirlo a SaaS multitenancy requiere cambios significativos pero planeados en backend y frontend.

**Estado actual:** ⚠️ No apto para producción sin resolver los puntos críticos de seguridad.

---

## Tabla de Contenidos
1. [Lo que está bien](#lo-que-está-bien)
2. [Problemas críticos de seguridad](#problemas-críticos-de-seguridad)
3. [Problemas de arquitectura y calidad](#problemas-de-arquitectura-y-calidad)
4. [Problemas de UI/UX](#problemas-de-uiux)
5. [Roadmap SaaS Multitenancy](#roadmap-saas-multitenancy)
6. [Plan de acción priorizado](#plan-de-acción-priorizado)

---

## Lo que está bien

### Backend ✅

- **`server.py:136-142` — Hashing bcrypt correcto.** Salt automático, encoding UTF-8 explícito en ambas direcciones.
- **`server.py:165-190` — Validación de tipo de token.** Verifica `payload.get("type") != "access"`, evitando que un refresh token se use como access token. También valida que el usuario siga existiendo en BD.
- **`server.py:240-262` — Rate limiting en login funcional.** 5 intentos fallidos → bloqueo 15 min. Los intentos se limpian en login exitoso.
- **`server.py:442-467` — Validaciones de stock antes de modificar BD.** Se valida cada item primero y solo se actualiza después.
- **`server.py:544-545` — Idempotencia en anulaciones.** No se puede anular una venta ya anulada.
- **`server.py:820-930` — Pipelines de aggregation correctos y eficientes.** Uso de `$unwind`, `$group`, `$match` con filtro de fechas al inicio del pipeline.
- **`server.py:1028-1031` — Índices creados en startup.** Email único en users, índice en `fecha_venta`.

### Frontend ✅

- **`App.js:13-38` — Protección de rutas bien implementada.** `ProtectedRoute` verifica `loading`, `user === false`, y el rol. Previene flashes de contenido no autorizado.
- **`App.js:29-35` — Redirección inteligente por rol.** Vendedor → `/ventas`, admin → `/`. Buen UX para sistemas multirol.
- **`AuthContext.js:9` — `withCredentials: true` global.** Configurar axios globalmente evita olvidar el flag en llamadas individuales.
- **`AuthContext.js:75-83` — Logout defensivo con `finally`.** El usuario nunca queda atrapado en sesión zombi aunque falle la llamada al backend.
- **`AuthContext.js:92-97` — Guard de contexto.** `useAuth` lanza error si se usa fuera de `AuthProvider`.
- **`SalesHistory.js:388-410` — `AlertDialog` para confirmaciones destructivas.** Correcto y accesible vs `window.confirm`.

### UI/UX ✅

- **Sistema de color monochrome + semáforo de stock.** 95% monocromo, colores solo para indicadores de stock. Correcto y coherente con `design_guidelines.json`.
- **Navegación filtrada por rol.** El vendedor ve solo "Ventas". No hay rutas innecesarias.
- **Flujo del POS.** Clic = +1 unidad, clic derecho = elegir cantidad. Balanceo correcto entre velocidad y control.
- **Botón de cobro con monto visible.** `Cobrar $XXX.XX` en el botón elimina pasos de recalculo.
- **Feedback con toasts específicos.** Mensajes concretos: "Stock restaurado", no genéricos.

---

## Problemas Críticos de Seguridad

### 🔴 CRÍTICO 1 — Credenciales hardcodeadas en código y archivos

**Backend:**
- `backend/.env:4` — `JWT_SECRET` con patrón predecible (`a1b2c3d4...`). No es un secreto criptográfico. Cualquiera con acceso al repo puede forjar tokens JWT válidos.
- `backend/.env:5-6` — `ADMIN_EMAIL/ADMIN_PASSWORD` con contraseña `admin123` trivialmente adivinable.
- `server.py:1056-1057` — Credenciales del usuario `vendedor` **hardcodeadas directamente en el código**, no en variables de entorno.
- `server.py:1072-1109` — En cada arranque, el servidor escribe un archivo `/app/memory/test_credentials.md` con contraseñas en texto plano al disco.

**Fix:**
```bash
# Generar JWT_SECRET seguro:
python -c "import secrets; print(secrets.token_hex(64))"
```

```python
# server.py — leer del entorno en lugar de hardcodear
vendedor_email = os.environ.get("VENDEDOR_EMAIL", "vendedor@inventario.com")
vendedor_password = os.environ.get("VENDEDOR_PASSWORD")
if not vendedor_password:
    raise RuntimeError("VENDEDOR_PASSWORD no configurado")

# Eliminar completamente el bloque que escribe test_credentials.md
```

```ini
# backend/.env
JWT_SECRET="<128-char-hex-generado>"
ADMIN_PASSWORD="<contraseña-fuerte>"
VENDEDOR_EMAIL="vendedor@inventario.com"
VENDEDOR_PASSWORD="<contraseña-fuerte>"
```

---

### 🔴 CRÍTICO 2 — Sin autorización por rol en endpoints de admin

`server.py:315-316` y muchos más — Los endpoints `create_product`, `update_product`, `delete_product`, `cancel_sale`, todos los reportes y dashboard solo verifican **autenticación** pero no verifican que el usuario sea `admin`. Un `vendedor` puede crear, editar, eliminar productos y anular ventas.

**Fix — crear dependencias de rol:**
```python
# server.py — agregar estas funciones helper
async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return user

async def require_seller_or_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] not in ("admin", "vendedor"):
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return user

# Uso en endpoints:
@api_router.post("/products")
async def create_product(product: ProductCreate, user: dict = Depends(require_admin)):
    ...

@api_router.post("/sales")
async def create_sale(sale: SaleCreate, user: dict = Depends(require_seller_or_admin)):
    ...
```

---

### 🔴 CRÍTICO 3 — Cookies sin `secure=True`

`server.py:223`, `268`, `305` — Las cookies httpOnly se setean con `secure=False`. Los tokens JWT viajan en texto plano sobre HTTP. En producción (siempre HTTPS) esto expone tokens a ataques MITM.

**Fix:**
```python
is_production = os.environ.get("ENVIRONMENT") == "production"

response.set_cookie(
    key="access_token",
    value=access_token,
    httponly=True,
    secure=is_production,  # True en prod, False solo en dev
    samesite="lax",
    max_age=3600,
    path="/"
)
```

---

### 🔴 CRÍTICO 4 — CORS permisivo con credenciales

- `backend/.env:3` — `CORS_ORIGINS="*"` definido pero **no se usa** en el código.
- `server.py:1018` — CORS real tiene hardcodeado `"https://stock-mvp-1.preview.emergentagent.com"` (ya eliminado). Con `allow_credentials=True` combinado con `allow_methods=["*"]` y `allow_headers=["*"]` es más permisivo de lo necesario.

**Fix:**
```python
# backend/.env
ALLOWED_ORIGINS="https://tu-dominio.com,http://localhost:3000"

# server.py
origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
```

---

### 🔴 CRÍTICO 5 — Dependencias no usadas que amplían superficie de ataque

`backend/requirements.txt` contiene 124 dependencias. Las siguientes **no se usan en ningún `import`** del código:

| Dependencia | Riesgo |
|---|---|
| `emergentintegrations==0.1.0` (eliminada) | Paquete externo no estándar, riesgo supply chain |
| `openai==1.99.9` | Superficie de ataque innecesaria |
| `google-genai==1.70.0` + stack completo Google AI | Ídem |
| `stripe==15.0.1` | Ídem |
| `boto3` + `botocore` (AWS SDK) | Ídem |
| `numpy==2.4.4`, `pandas==3.0.2` | Innecesario |
| `litellm==1.80.0`, `huggingface_hub` | Ídem |

**Fix:** Crear un `requirements.txt` limpio con solo las ~15 dependencias reales:
```
fastapi==0.110.1
uvicorn==0.25.0
motor==3.3.1
pymongo==4.5.0
pydantic==2.12.5
PyJWT==2.12.1
bcrypt==4.1.3
python-dotenv==1.2.2
email-validator==2.3.0
reportlab==4.4.10
python-dateutil==2.9.0.post0
python-multipart==0.0.24
starlette==0.37.2
```

---

### 🟡 MEDIO — Registro de usuarios abierto sin control

`server.py:202-232` — El endpoint `POST /api/auth/register` es público y sin protección ni rate limiting. Cualquiera puede crear cuentas. Los usuarios `"user"` no tienen acceso al frontend pero el backend no rechaza sus peticiones en los endpoints (ver CRÍTICO 2).

---

### 🟡 MEDIO — Sin validación de rangos en modelos Pydantic

`server.py:84-89` — `ProductCreate` no valida que `precio_unitario > 0` ni que `cantidad_stock >= 0`. Se puede insertar un producto con precio negativo o stock de -999.

**Fix:**
```python
from pydantic import Field

class ProductCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    precio_unitario: float = Field(gt=0)
    cantidad_stock: float = Field(ge=0)
    cantidad_minima: float = Field(ge=0)
    unidad_medida: UnitType

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=1, max_length=100)
```

---

## Problemas de Arquitectura y Calidad

### Backend

**Race condition en actualización de stock** (`server.py:490-504`)

Dos requests concurrentes pueden vender el último item al mismo tiempo porque ambas pasan la validación antes de actualizar. Fix con operación atómica:

```python
result = await db.products.update_one(
    {
        "_id": ObjectId(update["producto_id"]),
        "cantidad_stock": {"$gte": update["cantidad"]}  # condición atómica
    },
    {"$inc": {"cantidad_stock": -update["cantidad"]}}
)
if result.matched_count == 0:
    raise HTTPException(status_code=409, detail="Stock insuficiente (conflicto concurrente)")
```

**Sin paginación real** (`server.py:352`, `614`, `667`, `725`)

`to_list(1000)` en products y reportes. Con un negocio grande, traer 1000 documentos a memoria es ineficiente.

```python
@api_router.get("/sales")
async def list_sales(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    total = await db.sales.count_documents({})
    sales = await db.sales.find({}).sort("fecha_venta", -1).skip(skip).limit(limit).to_list(limit)
    return {"data": [...], "total": total, "skip": skip, "limit": limit}
```

**Sin health check real** (`server.py:1006-1008`)

El endpoint `/api/` devuelve un string estático, no verifica MongoDB.

```python
@api_router.get("/health")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
```

**ObjectId inválido devuelve 500** (múltiples endpoints)

`ObjectId(product_id)` lanza `bson.errors.InvalidId` si el string no tiene formato válido, lo que FastAPI convierte en 500 en lugar de 400.

```python
from bson.errors import InvalidId

def parse_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail=f"ID inválido: {id_str}")
```

**Estructura monolítica** (`server.py` = 1114 líneas)

Para producción y SaaS, separar en módulos:

```
backend/
    main.py              # app = FastAPI(), middlewares, include_router
    config.py            # Settings con pydantic-settings
    database.py          # conexión MongoDB
    auth/
        router.py
        dependencies.py  # get_current_user, require_admin, etc.
        models.py
    products/
        router.py
        models.py
    sales/
        router.py
        models.py
    reports/
        router.py
    tenants/             # nuevo para SaaS
        router.py
        models.py
```

### Frontend

**`formatCurrency` y `formatDate` duplicadas en 5 archivos**

Aparecen idénticas en `Dashboard.js:29`, `Products.js:182`, `Sales.js:244`, `SalesHistory.js:86`, `Reports.js:76`.

Fix — crear `src/utils/format.js`:
```javascript
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

export const formatDate = (dateString) =>
  new Date(dateString).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
```

**`API_URL` declarada en cada página individualmente**

Aparece 5 veces. Fix — centralizar en `src/lib/api.js`:
```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
if (!API_URL) throw new Error('REACT_APP_BACKEND_URL no definida');

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Interceptor para 401 global
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);
```

**`useCallback` importado pero no utilizado** — `Sales.js:1`

**Lógica de carrito duplicada** — `Sales.js:106-153`

`addToCartFromModal` y `quickAddToCart` tienen la misma lógica, solo difiere la cantidad inicial. Refactorizar como `addToCart(product, quantity)`.

**`CustomTooltip` definido dentro del componente padre** — `Reports.js:84-97`

Definir un componente dentro de otro hace que React lo desmonte/remonte en cada render. Moverlo fuera de la función `Reports()`.

---

## Problemas de UI/UX

### Críticos

**Cabinet Grotesk nunca se carga** (`index.css:1`, `design_guidelines.json:6`)

El design system especifica Cabinet Grotesk para headings pero `index.css` solo carga IBM Plex Sans. No hay diferenciación tipográfica entre heading y body text.

```css
/* index.css — reemplazar línea 1 */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Cabinet+Grotesk:wght@700;900&display=swap');

.font-heading {
  font-family: 'Cabinet Grotesk', sans-serif;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
```

**Clases CSS usadas pero no definidas en `index.css`**

Los componentes usan `.metric-value`, `.metric-label`, `.form-group`, `.form-label`, `.status-badge`, `.empty-state` — ninguna está definida en `index.css`. Esto produce estilos ausentes en producción.

```css
/* Agregar en index.css */
.metric-value { @apply text-2xl font-semibold text-zinc-900 leading-none; }
.metric-label { @apply text-xs uppercase tracking-[0.1em] text-zinc-500 mt-1; }
.form-group   { @apply space-y-1.5; }
.form-label   { @apply text-xs font-medium uppercase tracking-[0.1em] text-zinc-500; }
.status-badge { @apply text-xs px-2 py-0.5 rounded-sm font-medium; }
.empty-state  { @apply flex flex-col items-center justify-center text-zinc-400; }
```

**States de carga primitivos** (`Dashboard.js:46-50` y todos los módulos)

Todos muestran solo `<div>Cargando...</div>`. Implementar skeleton screens para evitar layout shift y reducir percepción de lentitud.

```jsx
// Ejemplo para Dashboard
if (loading) {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-zinc-100 rounded-sm animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-100 rounded-sm animate-pulse border border-zinc-200" />
        ))}
      </div>
    </div>
  );
}
```

**Error state silencioso** (`Dashboard.js:22-27` y todos los módulos)

Si la API falla, el dashboard muestra todos los valores en 0 sin mensaje. El usuario no sabe si no hay datos o si hubo error.

```jsx
const [fetchError, setFetchError] = useState(null);
// en catch: setFetchError('No se pudo cargar el resumen.');

if (fetchError) return (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <p className="text-zinc-600 text-sm">{fetchError}</p>
    <Button variant="outline" size="sm" onClick={fetchSummary}>Reintentar</Button>
  </div>
);
```

### Altos

**`window.confirm` para eliminar producto** (`Products.js:148`)

`window.confirm` es bloqueante, no personalizable, bloqueado en algunos entornos. `SalesHistory.js` ya usa el patrón correcto con `AlertDialog`. Inconsistencia en el mismo proyecto.

**Targets táctiles del carrito demasiado pequeños** (`Sales.js:369-396`)

Botones `-` y `+` de `h-7 w-7` (28×28px). El estándar mínimo táctil es 44×44px (WCAG 2.5.5). En un POS real con presión operativa, botones pequeños generan errores.

Fix: cambiar a `h-10 w-10`.

**Carrito no es sticky en tablet/desktop** (`Sales.js:280`)

En pantallas `< lg`, el carrito queda debajo de todos los productos. El cajero debe hacer scroll para cobrar.

```jsx
<div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
```

**Badges de métodos de pago usan colores fuera del sistema** (`SalesHistory.js:120-131`)

`bg-green-100`, `bg-blue-100`, `bg-purple-100` violan el design system que reserva color solo para stock. Reemplazar con `bg-zinc-100 text-zinc-700` para todos.

**Filtros del historial no se auto-aplican** (`SalesHistory.js:56-59`)

Cambiar el select de estado no actualiza la tabla automáticamente; hay que presionar "Filtrar". Agregar `useEffect` que reaccione a `statusFilter`.

**Botones icon-only sin `aria-label`** (`Products.js:349-366`, `SalesHistory.js:297-318`)

Con lector de pantalla, 20 botones de "Editar" son todos "botón, botón, botón..." sin contexto.

```jsx
<Button aria-label={`Editar ${product.nombre}`} ...>
  <Pencil className="h-4 w-4" aria-hidden="true" />
</Button>
```

### Medios

**El hint de instrucciones del POS está abajo del fold** (`Sales.js:344-346`)

"Clic = agregar 1 | Clic derecho = elegir cantidad" aparece al final de la grilla, en `text-zinc-400` (contraste insuficiente WCAG). Moverlo arriba del grid.

**No hay botón de imprimir en el recibo** (`Sales.js:548-592`)

En un POS real el cajero necesita imprimir el ticket. Fix trivial:

```jsx
<Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
```

**`<html lang="en">` en app en español** (`index.html:2`)

Los lectores de pantalla pronunciarán el español con acento inglés.

```html
<html lang="es-MX">
```

---

## Roadmap SaaS Multitenancy

### Arquitectura recomendada: campo `tenant_id` en documentos

| Estrategia | Ventaja | Desventaja |
|---|---|---|
| DB por tenant | Máximo aislamiento | Costosa, difícil de operar |
| Colecciones por tenant | Aislamiento en BD | Explosión de colecciones |
| **Campo `tenant_id`** ✅ | Simple, escala bien | Requiere filtrar en todos los queries |

Para un sistema POS con tenants medianos, la estrategia recomendada es **campo `tenant_id`** en todos los documentos. MongoDB maneja bien el filtrado con índices compuestos.

### 1. Nueva colección `tenants`

```json
{
  "_id": ObjectId,
  "slug": "empresa-xyz",
  "nombre": "Empresa XYZ",
  "plan": "starter | pro | enterprise",
  "activo": true,
  "owner_id": "ObjectId",
  "brand_color": "#000000",
  "logo_url": null,
  "created_at": "datetime"
}
```

### 2. Modelo de usuarios con roles por tenant

```json
{
  "_id": ObjectId,
  "email": "string",
  "password_hash": "string",
  "name": "string",
  "global_role": "superadmin | user",
  "tenants": [
    {
      "tenant_id": "ObjectId",
      "role": "owner | admin | vendedor",
      "activo": true
    }
  ]
}
```

Un usuario puede pertenecer a múltiples tenants (útil si administra varias tiendas).

### 3. Rutas con slug de tenant

```
/api/t/{tenant_slug}/products
/api/t/{tenant_slug}/sales
/api/t/{tenant_slug}/reports/statistics
```

### 4. Función central de autorización por tenant

```python
async def get_current_tenant_user(request: Request, tenant_slug: str) -> dict:
    user = await get_current_user(request)
    tenant = await db.tenants.find_one({"slug": tenant_slug, "activo": True})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    user_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    membership = next(
        (t for t in user_doc.get("tenants", [])
         if t["tenant_id"] == str(tenant["_id"]) and t["activo"]),
        None
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Sin acceso a este tenant")

    return {**user, "tenant_id": str(tenant["_id"]), "tenant_role": membership["role"]}

def require_tenant_role(*roles: str):
    async def dependency(request: Request, tenant_slug: str) -> dict:
        user = await get_current_tenant_user(request, tenant_slug)
        if user["tenant_role"] not in roles:
            raise HTTPException(status_code=403, detail="Rol insuficiente")
        return user
    return dependency
```

### 5. Todos los endpoints filtran por tenant

```python
@tenant_router.get("/products")
async def list_products(
    tenant_slug: str,
    user: dict = Depends(require_tenant_role("owner", "admin", "vendedor"))
):
    products = await db.products.find(
        {"tenant_id": user["tenant_id"]}  # SIEMPRE filtrar por tenant
    ).to_list(100)
    ...
```

### 6. Índices compuestos para multitenancy

```python
# CRÍTICO: tenant_id al frente de todos los índices
await db.products.create_index([("tenant_id", 1), ("nombre", 1)])
await db.sales.create_index([("tenant_id", 1), ("fecha_venta", -1)])
await db.stock_logs.create_index([("tenant_id", 1), ("producto_id", 1)])
# TTL para limpiar login_attempts automáticamente
await db.login_attempts.create_index("createdAt", expireAfterSeconds=900)
```

Sin `tenant_id` al frente, cada query haría un collection scan sobre todos los tenants.

### 7. Onboarding de nuevos tenants

```python
@api_router.post("/tenants/register")
async def register_tenant(data: TenantCreate):
    tenant_doc = {"slug": slugify(data.company_name), "nombre": data.company_name, "plan": "starter", "activo": True}
    tenant_result = await db.tenants.insert_one(tenant_doc)

    user_doc = {
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "global_role": "user",
        "tenants": [{"tenant_id": str(tenant_result.inserted_id), "role": "owner", "activo": True}]
    }
    await db.users.insert_one(user_doc)
    # Retornar JWT ya autenticado
```

### 8. Cambios en el Frontend para multitenancy

**Estrategia: subdominios por tenant**
```
acme.tuapp.com       → tenant_id: "acme"
bodega-lopez.tuapp.com → tenant_id: "bodega-lopez"
```

**`AuthContext.js` — leer tenant del subdominio:**
```javascript
function getTenantFromSubdomain() {
  const parts = window.location.hostname.split('.');
  return parts.length > 2 && parts[0] !== 'www' ? parts[0] : null;
}
```

**`src/lib/api.js` — interceptor de tenant:**
```javascript
api.interceptors.request.use((config) => {
  const tenant = getTenantFromSubdomain();
  if (tenant) config.headers['X-Tenant-ID'] = tenant;
  return config;
});
```

**`Layout.js` — branding por tenant:**
```jsx
{tenant?.logo_url
  ? <img src={tenant.logo_url} alt={tenant.nombre} className="h-8 w-auto" />
  : <Package className="h-5 w-5 text-white" />
}
<span>{tenant?.nombre || 'Inventario'}</span>
```

**Nuevo componente `TenantGuard`:**
```jsx
function TenantGuard({ children }) {
  const { tenantStatus } = useAuth();
  if (tenantStatus === 'suspended') return <SuspendedAccountPage />;
  if (tenantStatus === 'trial_expired') return <TrialExpiredPage />;
  return children;
}
```

---

## Plan de Acción Priorizado

### 🔴 Fase 1 — Antes de cualquier deploy (Esta semana)

| # | Acción | Archivo | Esfuerzo |
|---|---|---|---|
| 1 | Generar JWT_SECRET seguro, mover VENDEDOR_PASSWORD a .env | `backend/.env` + `server.py` | Bajo |
| 2 | Cambiar `secure=False` a `secure=is_production` en todas las cookies | `server.py:223,268,305` | Bajo |
| 3 | Agregar `require_admin` y `require_seller_or_admin` como dependencias en todos los endpoints | `server.py` | Medio |
| 4 | Configurar CORS desde variable de entorno, eliminar wildcard | `server.py:1014-1021` | Bajo |
| 5 | Limpiar `requirements.txt` a ~15 dependencias reales | `requirements.txt` | Bajo |
| 6 | Eliminar el bloque que escribe `test_credentials.md` | `server.py:1072-1109` | Bajo |

### 🟡 Fase 2 — Calidad de producción (Próximas 2 semanas)

| # | Acción | Archivo | Esfuerzo |
|---|---|---|---|
| 7 | Fix race condition de stock con `$inc` atómico | `server.py:490-504` | Bajo |
| 8 | Agregar `Field(gt=0, ge=0)` en modelos Pydantic | `server.py:84-134` | Bajo |
| 9 | Agregar endpoint `/health` que verifica MongoDB | `server.py` | Bajo |
| 10 | Crear `src/utils/format.js` y `src/lib/api.js` centralizados | Frontend | Bajo |
| 11 | Cargar Cabinet Grotesk y definir clases CSS faltantes | `index.css` | Bajo |
| 12 | Skeleton screens en todos los módulos | Todas las páginas | Medio |
| 13 | Error states visibles en Dashboard, Products, Reports | Dashboard, Products, Reports | Bajo |
| 14 | Reemplazar `window.confirm` en Products con `AlertDialog` | `Products.js:148` | Bajo |
| 15 | `aria-label` en todos los botones icon-only de tablas | Products, SalesHistory | Bajo |
| 16 | Corregir targets táctiles del carrito a `h-10 w-10` | `Sales.js:369-396` | Bajo |
| 17 | Sticky para el panel de cobro | `Sales.js:280` | Bajo |
| 18 | Unificar badges de métodos de pago a zinc | `SalesHistory.js:120-131` | Bajo |
| 19 | `<html lang="es-MX">` | `index.html:2` | Trivial |
| 20 | Separar `server.py` en módulos por dominio | Backend | Alto |

### 🟢 Fase 3 — Migración a SaaS Multitenancy

| # | Acción | Esfuerzo |
|---|---|---|
| 21 | Crear colección `tenants` con modelo y endpoints de registro | Medio |
| 22 | Migrar modelo de `users` a roles por tenant | Medio |
| 23 | Agregar `tenant_id` a todos los documentos existentes (migration script) | Medio |
| 24 | Crear función `get_current_tenant_user` y `require_tenant_role` | Bajo |
| 25 | Migrar todos los endpoints a prefix `/api/t/{tenant_slug}/...` | Alto |
| 26 | Crear índices compuestos con `tenant_id` | Bajo |
| 27 | Implementar `getTenantFromSubdomain()` en `AuthContext.js` | Bajo |
| 28 | Agregar interceptor de tenant en `src/lib/api.js` | Bajo |
| 29 | Modificar `Layout.js` para branding dinámico por tenant | Bajo |
| 30 | Crear `TenantGuard` para estados de cuenta | Medio |
| 31 | Crear pantalla de onboarding y `/configuracion/plan` | Medio |

---

## Cambios ya realizados en esta sesión

- ✅ Eliminado script `emergent-main.js` de `index.html`
- ✅ Eliminado badge "Made with Emergent" de `index.html`
- ✅ Eliminado script de PostHog (tracking de Emergent) de `index.html`
- ✅ Eliminado `@emergentbase/visual-edits` de `package.json`
- ✅ Eliminado bloque `withVisualEdits` de `craco.config.js`
- ✅ Eliminado `emergentintegrations` de `requirements.txt`
- ✅ Eliminado origen CORS hardcodeado de `server.py`
- ✅ Actualizado `frontend/.env` a `localhost:8000`
- ✅ Actualizado `backend/.env` FRONTEND_URL a `localhost:3000`
- ✅ Actualizados `backend_test.py` y `vendedor_test.py` a `localhost:8000`
- ✅ Corregido `<title>` e `<meta description>` del `index.html`
- ✅ Limpiada variable `isDevServer` no utilizada de `craco.config.js`
