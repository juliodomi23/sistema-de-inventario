# Mejoras pendientes — POS

## Alto impacto / relativamente fácil

### Botones de billetes rápidos (efectivo)
Al seleccionar pago en efectivo, mostrar botones preconfigurados: `$50` `$100` `$200` `$500` `$1000`.
Un clic llena el campo automáticamente. Útil cuando hay prisa y el cajero no quiere escribir.

### Atajos de teclado
- `F2` → enfocar búsqueda de producto
- `F4` → completar venta
- `Esc` → limpiar carrito (con confirmación)
Speedrun para cajeros que ya conocen el sistema.

### Nota en la venta
Campo de texto opcional en la venta ("sin cebolla", "entregar mañana", "cliente pidió factura").
Se guarda en la venta y aparece en el historial.

---

## Impacto medio / más trabajo

### Pago mixto (efectivo + transferencia/tarjeta)
Dividir el pago entre dos métodos. Ej: $150 efectivo + $50 tarjeta.
Muy común cuando el cliente no trae suficiente cash.

### Productos favoritos / fijados
Sección arriba del grid con los productos más vendidos (automático) o que el admin fije manualmente.
Evita buscar siempre lo mismo.

### Impresión de ticket térmico
Soporte para impresoras 80mm (tipo Epson TM-T20).
Opciones: `react-thermal-printer` o `window.print()` con CSS específico para impresora.

---

## Menor prioridad / más nicho

### Venta en espera (hold)
Pausar venta actual, atender otro cliente y retomar.
Útil si hay dos cajas o el cliente "va por más dinero".

### Precio especial por cliente
Clientes con descuento automático (ej. mayoristas).
Se configuraría en el perfil del cliente.
