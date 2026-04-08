# Sistema de Inventario MVP - PRD

## Problem Statement Original
Sistema de Inventario MVP - Aplicación web de inventario simple con gestión de productos y ventas.

## User Choices
- Login simple con JWT
- Interfaz en español
- Moneda MXN (pesos mexicanos)
- Sin preferencias de diseño adicionales

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React 19 + Shadcn UI + Tailwind CSS
- **Auth**: JWT tokens en httpOnly cookies
- **Database**: MongoDB con colecciones: users, products, sales, stock_logs, login_attempts

## User Personas
1. **Administrador**: Gestiona productos, realiza ventas, ve dashboard
2. **Usuario**: Puede registrarse y usar el sistema

## Core Requirements (Static)
1. ✅ Gestión de productos (CRUD)
2. ✅ Indicadores de stock (verde/amarillo/rojo)
3. ✅ Sistema de ventas con carrito
4. ✅ Múltiples métodos de pago
5. ✅ Cálculo de cambio en efectivo
6. ✅ Dashboard con KPIs
7. ✅ Autenticación JWT

## Implementation Status (2026-04-08)
### Completed
- [x] Login/Register con JWT y cookies httpOnly
- [x] Dashboard con métricas: productos totales, ventas del día, transacciones, stock bajo
- [x] Estado de inventario: verde (óptimo), amarillo (medio), rojo (crítico)
- [x] CRUD de productos con validaciones
- [x] Sistema de ventas POS con carrito
- [x] Métodos de pago: efectivo, transferencia, tarjeta
- [x] Cálculo automático de cambio en efectivo
- [x] Actualización de stock en tiempo real
- [x] Recibo de venta post-compra
- [x] Logs de cambios de stock
- [x] Protección brute force en login
- [x] Admin seeding automático
- [x] **Anular/deshacer ventas con restauración automática de stock**
- [x] **Historial de ventas con filtrado por fecha y estado**
- [x] **Exportar reportes a CSV y PDF**
- [x] **Página de Reportes con gráficas (ventas diarias, métodos de pago, tendencias)**
- [x] **Productos más vendidos**
- [x] **Filtros avanzados: fecha inicio/fin, estado de venta**

### Test Results
- Backend: 100% (26/26 tests)
- Frontend: 95%

## Prioritized Backlog
### P0 (Critical) - Done
- Todas las funcionalidades core y reportes implementados

### P1 (High Priority) - Done
- Anular ventas ✓
- Exportar reportes CSV/PDF ✓
- Gráficas de ventas ✓
- Filtros por fecha ✓

### P2 (Medium Priority)
- [ ] Gráficas de ventas (Chart.js/Recharts)
- [ ] Filtros y búsqueda en productos
- [ ] Historial de ventas detallado

### P3 (Low Priority)
- [ ] Múltiples usuarios/roles
- [ ] Notificaciones de stock bajo
- [ ] Backup automático de BD

## Credentials
- Admin: admin@inventario.com / admin123
