# Sistema de Inventario y POS — Referencia Técnica

> Estado actual del sistema: funcionalidades, endpoints, arquitectura y configuración.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI (Python 3.11) |
| Base de datos | MongoDB 7 con Motor (async driver) |
| Frontend | React 19 + Tailwind CSS + Shadcn UI |
| Autenticación | JWT en cookies httpOnly |
| Servidor web | nginx (proxy `/api/` → backend internamente) |
| Despliegue | Docker Compose + EasyPanel |

---

## Arquitectura del backend

```
backend/
├── main.py              # App FastAPI, CORS, startup/shutdown, seed de usuarios
├── config.py            # JWT_SECRET, JWT_ALGORITHM, IS_PRODUCTION
├── database.py          # Conexión MongoDB (Motor), exporta `db` y `client`
├── dependencies.py      # Funciones compartidas: auth, hashing, guards, helpers
├── server.py            # Shim de compatibilidad → importa desde main.py
├── models/
│   ├── enums.py         # UnitType, PaymentMethod
│   ├── user.py          # UserCreate, AdminUserCreate, UserLogin, UserResponse
│   ├── product.py       # ProductCreate, ProductUpdate, ProductResponse
│   ├── sale.py          # SaleItemCreate, SaleCreate, SaleItemResponse, SaleResponse
│   ├── category.py      # CategoryCreate, CategoryResponse
│   ├── stock_entry.py   # StockEntryCreate, StockEntryResponse
│   ├── cash_register.py # CashRegisterOpen, CashRegisterClose, CashRegisterResponse
│   └── customer.py      # CustomerCreate, CustomerUpdate, CustomerResponse, CustomerPaymentCreate
└── routers/
    ├── auth.py          # /api/auth/*
    ├── admin.py         # /api/admin/users/*
    ├── products.py      # /api/products/*
    ├── categories.py    # /api/categories/*
    ├── sales.py         # /api/sales/*
    ├── stock_entries.py # /api/stock-entries/*
    ├── cash_register.py # /api/cash-register/*
    ├── customers.py     # /api/customers/*
    ├── reports.py       # /api/reports/*
    └── dashboard.py     # /api/dashboard/*
```

### `dependencies.py` — funciones exportadas

| Función | Tipo | Descripción |
|---------|------|-------------|
| `hash_password(password)` | util | Hashea con bcrypt |
| `verify_password(plain, hashed)` | util | Verifica hash bcrypt |
| `create_access_token(user_id, email)` | util | JWT access, expira en 60 min |
| `create_refresh_token(user_id)` | util | JWT refresh, expira en 7 días |
| `get_current_user(request)` | async util | Extrae usuario del cookie o header Bearer |
| `require_admin(request)` | FastAPI Depends | 403 si el rol no es `admin` |
| `require_seller_or_admin(request)` | FastAPI Depends | 403 si el rol no es `admin` ni `vendedor` |
| `parse_object_id(id_str)` | util | Convierte string a ObjectId, 400 si inválido |
| `get_stock_status(stock, minimo)` | util | Devuelve `"red"` / `"yellow"` / `"green"` |

### Lógica de stock status

```
stock <= minimo          → "red"    (crítico)
stock <= minimo + 2      → "yellow" (medio)
stock >  minimo + 2      → "green"  (óptimo)
```

---

## Variables de entorno

### Backend

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `MONGO_URL` | ✅ | — | URL de conexión MongoDB |
| `DB_NAME` | ✅ | `inventario` | Nombre de la base de datos |
| `JWT_SECRET` | ✅ | token aleatorio | Clave para firmar JWT (mín. 64 chars hex en prod) |
| `ADMIN_EMAIL` | ✅ | `admin@inventario.com` | Email del admin inicial |
| `ADMIN_PASSWORD` | ✅ | `admin123` | Contraseña del admin inicial |
| `VENDEDOR_EMAIL` | ⬜ | `vendedor@inventario.com` | Email del vendedor inicial |
| `VENDEDOR_PASSWORD` | ✅ | — | Contraseña del vendedor inicial |
| `ALLOWED_ORIGINS` | ✅ | `http://localhost:3000` | CORS origins (separados por coma) |
| `ENVIRONMENT` | ⬜ | `development` | `production` activa cookies `Secure` |

### Frontend (build-time)

| Variable | Descripción |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | URL pública del frontend (nginx hace proxy de `/api/` internamente) |

> En EasyPanel: configurar como variable de entorno normal. El `docker-compose.yml` la pasa como build arg automáticamente.

---

## Base de datos — Colecciones y schemas

### `users`
```json
{
  "_id": ObjectId,
  "email": "string (unique)",
  "password_hash": "string (bcrypt)",
  "name": "string",
  "role": "admin | vendedor",
  "created_at": "datetime"
}
```

### `products`
```json
{
  "_id": ObjectId,
  "nombre": "string",
  "precio_unitario": "number",
  "unidad_medida": "kg | gramos | L | piezas | bolsas | cajas | metros",
  "cantidad_stock": "number",
  "cantidad_minima": "number",
  "categoria_id": "string | null",
  "codigo_barras": "string | null (sparse index)",
  "fecha_creacion": "datetime"
}
```

### `categories`
```json
{
  "_id": ObjectId,
  "nombre": "string",
  "descripcion": "string | null",
  "fecha_creacion": "datetime"
}
```

### `sales`
```json
{
  "_id": ObjectId,
  "fecha_venta": "datetime",
  "metodo_pago": "efectivo | transferencia | tarjeta | fiado",
  "monto_subtotal": "number",
  "descuento_tipo": "porcentaje | monto_fijo | null",
  "descuento_valor": "number | null",
  "monto_descuento": "number",
  "monto_total": "number",
  "cambio": "number | null",
  "monto_recibido": "number | null",
  "estado": "completada | anulada",
  "cliente_id": "string | null",
  "cliente_nombre": "string | null",
  "fecha_anulacion": "datetime | null",
  "anulada_por": "string | null",
  "items": [
    {
      "producto_id": "string",
      "producto_nombre": "string",
      "cantidad_vendida": "number",
      "precio_unitario": "number",
      "subtotal": "number"
    }
  ]
}
```

### `stock_entries`
```json
{
  "_id": ObjectId,
  "producto_id": "string",
  "producto_nombre": "string",
  "cantidad": "number",
  "costo_unitario": "number | null",
  "notas": "string | null",
  "usuario_id": "string",
  "usuario_nombre": "string",
  "fecha": "datetime"
}
```

### `stock_logs`
```json
{
  "_id": ObjectId,
  "producto_id": "string",
  "cantidad_anterior": "number",
  "cantidad_nueva": "number",
  "tipo": "creacion | actualizacion | venta | anulacion_venta | entrada",
  "venta_id": "string | null",
  "fecha": "datetime"
}
```

### `cash_registers`
```json
{
  "_id": ObjectId,
  "estado": "abierto | cerrado",
  "monto_inicial": "number",
  "monto_contado": "number | null",
  "monto_esperado": "number | null",
  "diferencia": "number | null",
  "ventas_efectivo": "number",
  "ventas_total": "number",
  "notas_apertura": "string | null",
  "notas_cierre": "string | null",
  "usuario_id": "string",
  "usuario_nombre": "string",
  "fecha_apertura": "datetime",
  "fecha_cierre": "datetime | null"
}
```

### `customers`
```json
{
  "_id": ObjectId,
  "nombre": "string",
  "telefono": "string | null",
  "email": "string | null",
  "limite_credito": "number",
  "saldo_pendiente": "number",
  "notas": "string | null",
  "fecha_creacion": "datetime"
}
```

### `customer_payments`
```json
{
  "_id": ObjectId,
  "cliente_id": "string",
  "cliente_nombre": "string",
  "monto": "number",
  "notas": "string | null",
  "usuario_id": "string",
  "usuario_nombre": "string",
  "fecha": "datetime"
}
```

### `login_attempts`
```json
{
  "_id": ObjectId,
  "identifier": "string (ip:email)",
  "failed_attempts": "number",
  "lockout_until": "datetime"
}
```

---

## Índices MongoDB (creados en startup)

| Colección | Campo | Tipo |
|-----------|-------|------|
| `users` | `email` | unique |
| `login_attempts` | `identifier` | normal |
| `products` | `nombre` | normal |
| `products` | `codigo_barras` | sparse |
| `sales` | `fecha_venta` | normal |
| `categories` | `nombre` | normal |
| `stock_entries` | `producto_id` | normal |
| `stock_entries` | `fecha` | normal |
| `cash_registers` | `estado` | normal |
| `cash_registers` | `fecha_apertura` | normal |
| `customers` | `nombre` | normal |
| `customer_payments` | `cliente_id` | normal |

---

## API Endpoints completos

### Roles
- `A` = solo admin
- `A+V` = admin y vendedor

---

### Auth — `/api/auth`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/login` | público | Login, devuelve cookies JWT |
| `POST` | `/logout` | — | Elimina cookies JWT |
| `GET` | `/me` | A+V | Usuario actual |
| `POST` | `/refresh` | — | Renueva access token con refresh token |

### Admin — `/api/admin`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/users` | A | Lista todos los usuarios |
| `POST` | `/users` | A | Crea usuario (email, password, name, role) |
| `DELETE` | `/users/{id}` | A | Elimina usuario (no puede eliminar su propia cuenta) |
| `PUT` | `/users/{id}/password` | A | Cambia contraseña de cualquier usuario |

### Categorías — `/api/categories`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/` | A+V | Lista todas las categorías |
| `POST` | `/` | A | Crea categoría |
| `PUT` | `/{id}` | A | Edita categoría |
| `DELETE` | `/{id}` | A | Elimina (falla si tiene productos asignados) |

### Productos — `/api/products`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/` | A+V | Lista todos los productos con stock_status |
| `POST` | `/` | A | Crea producto |
| `GET` | `/barcode/{codigo}` | A+V | Busca producto por código de barras |
| `GET` | `/{id}` | A+V | Obtiene producto por ID |
| `PUT` | `/{id}` | A | Edita producto |
| `DELETE` | `/{id}` | A | Elimina producto |

> La ruta `/barcode/{codigo}` está registrada **antes** de `/{id}` para evitar conflictos de routing.

### Ventas — `/api/sales`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/today-summary` | A | Total y cantidad de ventas del día |
| `GET` | `/` | A | Lista ventas (limit=50 por defecto) |
| `POST` | `/` | A+V | Crea venta, descuenta stock atómicamente |
| `POST` | `/{id}/cancel` | A | Anula venta y restaura stock |

**Body de `POST /api/sales`:**
```json
{
  "items": [{ "producto_id": "string", "cantidad": 1 }],
  "metodo_pago": "efectivo | transferencia | tarjeta | fiado",
  "monto_recibido": 100.0,
  "cliente_id": "string | null",
  "descuento_tipo": "porcentaje | monto_fijo | null",
  "descuento_valor": 10
}
```

**Lógica de venta:**
1. Valida stock de cada item
2. Calcula `monto_subtotal`
3. Aplica descuento → `monto_total`
4. Para `efectivo`: valida `monto_recibido >= monto_total`, calcula cambio
5. Para `fiado`: requiere `cliente_id`, valida límite de crédito, incrementa `saldo_pendiente`
6. Inserta venta en BD
7. Descuenta stock con `$inc` + condición `$gte` (protección contra race conditions)
8. Registra en `stock_logs`

### Entradas de stock — `/api/stock-entries`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/` | A | Registra entrada, incrementa stock del producto |
| `GET` | `/` | A | Lista entradas recientes (limit=100) |
| `GET` | `/product/{product_id}` | A | Historial de entradas de un producto |

### Corte de caja — `/api/cash-register`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/current` | A+V | Turno actualmente abierto (null si no hay) |
| `POST` | `/open` | A+V | Abre un turno (falla si ya hay uno abierto) |
| `POST` | `/close` | A+V | Cierra turno, calcula ventas y diferencia |
| `GET` | `/` | A+V | Historial de cortes (limit=30) |
| `GET` | `/{id}` | A | Detalle de un corte específico |

**Lógica de cierre:**
- Suma ventas en efectivo desde `fecha_apertura` hasta ahora
- `monto_esperado = monto_inicial + ventas_efectivo`
- `diferencia = monto_contado - monto_esperado`
- Diferencia positiva = sobrante, negativa = faltante

**`GET /current` calcula en vivo** `ventas_efectivo` y `ventas_total` con aggregate desde la apertura.

### Clientes — `/api/customers`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/` | A+V | Lista todos los clientes |
| `POST` | `/` | A | Crea cliente |
| `GET` | `/{id}` | A+V | Obtiene cliente por ID |
| `PUT` | `/{id}` | A | Edita cliente |
| `DELETE` | `/{id}` | A | Elimina (falla si tiene saldo pendiente) |
| `GET` | `/{id}/sales` | A | Ventas del cliente |
| `POST` | `/{id}/payments` | A | Registra pago de deuda |
| `GET` | `/{id}/payments` | A | Historial de pagos del cliente |

### Reportes — `/api/reports`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/sales` | A | Ventas con filtros de fecha y estado |
| `GET` | `/sales/export/csv` | A | Exporta ventas a CSV |
| `GET` | `/sales/export/pdf` | A | Exporta ventas a PDF (ReportLab) |
| `GET` | `/statistics?days=7` | A | Estadísticas para gráficas (7/14/30/90 días) |

**`/statistics` devuelve:**
- `daily_sales` — ventas diarias (para gráfica de barras)
- `payment_breakdown` — desglose por método de pago (para pie chart)
- `top_products` — top 5 productos más vendidos por ingreso

### Dashboard — `/api/dashboard`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/summary` | A | KPIs del día + conteo de stock por estado + últimas 5 ventas |

### Sistema

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/api/health` | público | Estado del servidor y BD |
| `GET` | `/api/` | público | Mensaje de bienvenida |

---

## Módulos del frontend

### Páginas y acceso por rol

| Ruta | Archivo | Rol | Descripción |
|------|---------|-----|-------------|
| `/` | `Dashboard.js` | A | KPIs del día, stock por estado, últimas ventas |
| `/productos` | `Products.js` | A | CRUD de productos + categoría + código de barras |
| `/categorias` | `Categories.js` | A | CRUD de categorías |
| `/entradas` | `StockEntries.js` | A | Registrar entradas de mercancía |
| `/ventas` | `Sales.js` | A+V | POS completo |
| `/historial` | `SalesHistory.js` | A | Historial con filtros, anulación |
| `/reportes` | `Reports.js` | A | Gráficas + exportación CSV/PDF |
| `/corte` | `CashRegister.js` | A+V | Turno activo + historial de cortes |
| `/clientes` | `Customers.js` | A | Clientes, crédito y pagos |
| `/usuarios` | `Users.js` | A | Gestión de usuarios |
| `/login` | `Login.js` | público | Autenticación |

### Punto de Venta (`Sales.js`) — funciones

- **Grid de productos** con indicadores de color por stock
- **Clic** = agregar 1 unidad | **Clic derecho** = modal para elegir cantidad
- **Búsqueda** por nombre en tiempo real
- **Tabs de categoría** para filtrar el grid
- **Input de código de barras** con debounce + Enter → busca y agrega automáticamente
- **Carrito** con controles +/−/eliminar
- **Descuento** colapsable: porcentaje o monto fijo, preview en tiempo real
- **Métodos de pago**: Efectivo (con cálculo de cambio) / Transferencia / Tarjeta / Fiado
- **Fiado**: requiere seleccionar cliente, muestra límite y saldo, alerta si excede crédito
- **Recibo** en dialog tras completar venta
- **WhatsApp**: botón para enviar recibo por wa.me si el cliente tiene teléfono

### Corte de Caja (`CashRegister.js`) — flujo

1. Sin turno abierto → formulario "Abrir Turno" con monto inicial
2. Turno abierto → card con: monto inicial, ventas efectivo (vivo), otras ventas, esperado en caja
3. "Cerrar Turno" → dialog con desglose completo + input de monto contado + preview de diferencia
4. Historial de cortes pasados con diferencia coloreada (verde=sobrante, rojo=faltante)

---

## Seguridad

| Mecanismo | Implementación |
|-----------|---------------|
| Autenticación | JWT en cookies `httpOnly`, `Secure` (en producción), `SameSite=lax` |
| Access token | 60 minutos de duración |
| Refresh token | 7 días, rota el access token |
| Brute force | 5 intentos fallidos → bloqueo de 15 min por `ip:email` |
| Roles | Guard en cada endpoint con FastAPI `Depends` |
| CORS | Lista blanca desde `ALLOWED_ORIGINS` env var |
| Contraseñas | Bcrypt con salt automático |
| Stock concurrente | Update atómico: `$inc` con condición `$gte` → 409 si hay race condition |
| IDs MongoDB | `parse_object_id()` → 400 en lugar de 500 para IDs inválidos |
| Registro público | Desactivado — usuarios solo desde panel admin |

---

## Docker Compose

```
mongo      ← MongoDB 7 con volumen persistente
backend    ← FastAPI en puerto 8000 (red interna)
frontend   ← nginx en puerto 80 (red pública + easypanel)
```

nginx hace proxy de `/api/*` → `http://backend:8000` internamente.
Solo el servicio `frontend` necesita dominio público (puerto 80).

El backend y MongoDB **no se exponen al exterior**.
