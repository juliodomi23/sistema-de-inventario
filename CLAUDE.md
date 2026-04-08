# Sistema de Inventario - Documentación Completa

## Descripción General
Sistema de inventario web completo con gestión de productos, punto de venta (POS), reportes y control de acceso por roles. Desarrollado con React + FastAPI + MongoDB.

---

## Credenciales de Acceso

### Administrador
- **Email:** admin@inventario.com
- **Contraseña:** admin123
- **Acceso:** Todas las secciones (Dashboard, Productos, Ventas, Historial, Reportes)

### Vendedor
- **Email:** vendedor@inventario.com
- **Contraseña:** vendedor123
- **Acceso:** Solo Punto de Venta (Ventas)

---

## Stack Tecnológico

### Backend
- **Framework:** FastAPI (Python)
- **Base de datos:** MongoDB con Motor (async driver)
- **Autenticación:** JWT en cookies httpOnly
- **Librerías:** bcrypt, PyJWT, reportlab (PDF), python-dateutil

### Frontend
- **Framework:** React 19
- **Estilos:** Tailwind CSS
- **Componentes:** Shadcn UI
- **Gráficas:** Recharts
- **Routing:** React Router DOM v7

---

## Estructura del Proyecto

```
/app
├── backend/
│   ├── server.py          # API principal FastAPI
│   ├── requirements.txt   # Dependencias Python
│   └── .env               # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── App.js         # Rutas y providers
│   │   ├── App.css        # Estilos globales
│   │   ├── index.css      # Tailwind + variables CSS
│   │   ├── contexts/
│   │   │   └── AuthContext.js    # Manejo de autenticación
│   │   ├── components/
│   │   │   ├── Layout.js         # Layout con navegación por rol
│   │   │   └── ui/               # Componentes Shadcn
│   │   └── pages/
│   │       ├── Login.js          # Página de login/registro
│   │       ├── Dashboard.js      # KPIs y resumen
│   │       ├── Products.js       # CRUD de productos
│   │       ├── Sales.js          # Punto de Venta (POS)
│   │       ├── SalesHistory.js   # Historial con filtros
│   │       └── Reports.js        # Gráficas y exportación
│   ├── package.json
│   └── .env
└── memory/
    ├── PRD.md                    # Product Requirements Document
    └── test_credentials.md       # Credenciales de prueba
```

---

## Módulos del Sistema

### 1. Autenticación (`/api/auth/*`)
- Login con JWT en cookies httpOnly
- Registro de nuevos usuarios
- Protección contra fuerza bruta (5 intentos = 15 min bloqueo)
- Refresh token automático
- Roles: `admin`, `vendedor`

### 2. Dashboard (`/`)
Solo accesible para rol `admin`.

**Métricas:**
- Total de productos
- Ventas del día (MXN)
- Transacciones del día
- Productos con stock bajo

**Indicadores de inventario:**
- 🟢 Stock Óptimo (stock > mínimo + 2)
- 🟡 Stock Medio (mínimo < stock ≤ mínimo + 2)
- 🔴 Stock Crítico (stock ≤ mínimo)

**Últimas ventas:** Lista de las 5 ventas más recientes

### 3. Gestión de Productos (`/productos`)
Solo accesible para rol `admin`.

**Campos:**
- Nombre
- Precio unitario (MXN)
- Unidad de medida: kg, gramos, L, piezas, bolsas, cajas, metros
- Cantidad en stock
- Cantidad mínima (para alertas)

**Operaciones:** Crear, Editar, Eliminar

### 4. Punto de Venta - POS (`/ventas`)
Accesible para roles `admin` y `vendedor`.

**Características:**
- Productos en cuadrícula clickeable
- Indicadores de color por estado de stock
- Clic = agregar 1 unidad
- Clic derecho = elegir cantidad
- Búsqueda de productos en tiempo real
- Carrito con controles +/-

**Métodos de pago:**
- Efectivo (con cálculo automático de cambio)
- Transferencia
- Tarjeta

**Flujo:**
1. Seleccionar productos
2. Elegir método de pago
3. Si es efectivo, ingresar monto recibido
4. Completar venta
5. Se actualiza stock automáticamente
6. Se muestra recibo

### 5. Historial de Ventas (`/historial`)
Solo accesible para rol `admin`.

**Filtros:**
- Fecha inicio
- Fecha fin
- Estado (completadas, anuladas, todas)

**Funciones:**
- Ver detalle de cada venta
- Anular ventas (restaura stock automáticamente)
- Resumen con totales filtrados

### 6. Reportes y Estadísticas (`/reportes`)
Solo accesible para rol `admin`.

**Gráficas:**
- Ventas diarias (barras)
- Métodos de pago (pie)
- Tendencia de ventas (línea)
- Top 5 productos más vendidos

**Filtros temporales:** 7, 14, 30, 90 días

**Exportación:**
- CSV (con filtros de fecha y estado)
- PDF (reporte profesional con resumen)

---

## API Endpoints

### Autenticación
```
POST /api/auth/register    - Registrar usuario
POST /api/auth/login       - Iniciar sesión
POST /api/auth/logout      - Cerrar sesión
GET  /api/auth/me          - Obtener usuario actual
POST /api/auth/refresh     - Refrescar token
```

### Productos
```
GET    /api/products           - Listar productos
POST   /api/products           - Crear producto
GET    /api/products/:id       - Obtener producto
PUT    /api/products/:id       - Actualizar producto
DELETE /api/products/:id       - Eliminar producto
```

### Ventas
```
GET  /api/sales                    - Listar ventas
POST /api/sales                    - Crear venta
POST /api/sales/:id/cancel         - Anular venta
GET  /api/sales/today-summary      - Resumen del día
```

### Dashboard
```
GET /api/dashboard/summary    - Resumen completo
```

### Reportes
```
GET /api/reports/sales                  - Ventas con filtros
GET /api/reports/sales/export/csv       - Exportar CSV
GET /api/reports/sales/export/pdf       - Exportar PDF
GET /api/reports/statistics?days=7      - Estadísticas para gráficas
```

---

## Base de Datos (MongoDB)

### Colecciones

**users**
```json
{
  "_id": ObjectId,
  "email": "string",
  "password_hash": "string (bcrypt)",
  "name": "string",
  "role": "admin | vendedor | user",
  "created_at": "datetime"
}
```

**products**
```json
{
  "_id": ObjectId,
  "nombre": "string",
  "precio_unitario": "number",
  "unidad_medida": "kg | gramos | L | piezas | bolsas | cajas | metros",
  "cantidad_stock": "number",
  "cantidad_minima": "number",
  "fecha_creacion": "datetime"
}
```

**sales**
```json
{
  "_id": ObjectId,
  "fecha_venta": "datetime",
  "metodo_pago": "efectivo | transferencia | tarjeta",
  "monto_total": "number",
  "cambio": "number | null",
  "monto_recibido": "number | null",
  "estado": "completada | anulada",
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

**stock_logs**
```json
{
  "_id": ObjectId,
  "producto_id": "string",
  "cantidad_anterior": "number",
  "cantidad_nueva": "number",
  "tipo": "creacion | actualizacion | venta | anulacion_venta",
  "venta_id": "string | null",
  "fecha": "datetime"
}
```

**login_attempts**
```json
{
  "_id": ObjectId,
  "identifier": "string (ip:email)",
  "failed_attempts": "number",
  "lockout_until": "datetime"
}
```

---

## Variables de Entorno

### Backend (`/app/backend/.env`)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
JWT_SECRET="<64-char-hex>"
ADMIN_EMAIL="admin@inventario.com"
ADMIN_PASSWORD="admin123"
FRONTEND_URL="https://..."
```

### Frontend (`/app/frontend/.env`)
```
REACT_APP_BACKEND_URL=https://...
WDS_SOCKET_PORT=443
```

---

## Lógica de Negocio

### Indicadores de Stock
```python
def get_stock_status(cantidad_stock, cantidad_minima):
    if cantidad_stock <= cantidad_minima:
        return "red"      # Crítico
    elif cantidad_stock <= cantidad_minima + 2:
        return "yellow"   # Medio
    else:
        return "green"    # Óptimo
```

### Anulación de Ventas
1. Verificar que la venta no esté ya anulada
2. Para cada item de la venta:
   - Obtener producto actual
   - Restaurar stock (stock_actual + cantidad_vendida)
   - Registrar en stock_logs
3. Marcar venta como "anulada"
4. Registrar fecha y usuario que anuló

### Validaciones de Venta
- No vender más de lo disponible en stock
- Efectivo: monto recibido >= total
- Cambio calculado automáticamente
- Transacción atómica (todo o nada)

---

## Roles y Permisos

| Función | Admin | Vendedor |
|---------|-------|----------|
| Dashboard | ✅ | ❌ |
| Productos (CRUD) | ✅ | ❌ |
| Punto de Venta | ✅ | ✅ |
| Historial | ✅ | ❌ |
| Anular ventas | ✅ | ❌ |
| Reportes | ✅ | ❌ |
| Exportar CSV/PDF | ✅ | ❌ |

---

## Comandos Útiles

### Reiniciar servicios
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

### Ver logs
```bash
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

### Acceder a MongoDB
```bash
mongosh test_database
```

### Limpiar datos de prueba
```bash
mongosh test_database --eval "
  db.products.deleteMany({});
  db.sales.deleteMany({});
  db.stock_logs.deleteMany({});
"
```

---

## Notas de Desarrollo

- Hot reload habilitado para frontend y backend
- CORS configurado para permitir cookies cross-origin
- Todos los endpoints de API tienen prefijo `/api`
- Las fechas se manejan en UTC y se formatean en el frontend
- Los IDs de MongoDB se convierten a string antes de enviar al frontend
- Passwords hasheados con bcrypt (salt automático)
