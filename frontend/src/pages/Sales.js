import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import { formatCurrency, formatDate } from '../utils/format';
import {
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  ArrowRightLeft, CheckCircle, AlertCircle, Package, Search,
  Scan, ChevronDown, ChevronUp, Clock, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowRightLeft },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'fiado', label: 'Fiado', icon: Clock },
];

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [error, setError] = useState('');
  const [quantityModal, setQuantityModal] = useState({ open: false, product: null, quantity: 1 });

  // Descuento
  const [showDiscount, setShowDiscount] = useState(false);
  const [descuentoTipo, setDescuentoTipo] = useState(null);
  const [descuentoValor, setDescuentoValor] = useState('');

  // Fiado / cliente
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const barcodeRef = useRef(null);
  const barcodeDebounceRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!loading && barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [loading]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/api/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const getStockColor = (status) => {
    const colors = {
      green: 'border-emerald-400 bg-emerald-50',
      yellow: 'border-amber-400 bg-amber-50',
      red: 'border-rose-400 bg-rose-50'
    };
    return colors[status] || 'border-zinc-200';
  };

  const getStockBadgeColor = (status) => {
    const colors = {
      green: 'bg-emerald-500',
      yellow: 'bg-amber-500',
      red: 'bg-rose-500'
    };
    return colors[status] || 'bg-zinc-300';
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === null || p.categoria_id === selectedCategory;
    return matchesSearch && matchesCategory && p.cantidad_stock > 0;
  });

  const handleBarcodeChange = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);

    if (barcodeDebounceRef.current) {
      clearTimeout(barcodeDebounceRef.current);
    }

    if (value.length >= 3) {
      barcodeDebounceRef.current = setTimeout(async () => {
        await lookupBarcode(value);
      }, 600);
    }
  };

  const handleBarcodeKeyDown = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      if (barcodeDebounceRef.current) {
        clearTimeout(barcodeDebounceRef.current);
      }
      await lookupBarcode(barcodeInput.trim());
    }
  };

  const lookupBarcode = async (code) => {
    try {
      const response = await api.get(`/api/products/barcode/${code}`);
      const product = response.data;
      quickAddToCart(product);
      setBarcodeInput('');
    } catch (error) {
      toast.error('Código de barras no encontrado');
      setBarcodeInput('');
    }
  };

  const openQuantityModal = (product) => {
    const existingItem = cart.find(item => item.producto_id === product.id);
    const currentInCart = existingItem ? existingItem.cantidad : 0;
    const maxAvailable = product.cantidad_stock - currentInCart;

    if (maxAvailable <= 0) {
      toast.error('No hay más stock disponible');
      return;
    }

    setQuantityModal({
      open: true,
      product,
      quantity: 1,
      maxAvailable
    });
  };

  const addToCartFromModal = () => {
    const { product, quantity } = quantityModal;
    if (!product || quantity <= 0) return;

    const existingItem = cart.find(item => item.producto_id === product.id);
    const currentQuantity = existingItem ? existingItem.cantidad : 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > product.cantidad_stock) {
      toast.error(`Stock insuficiente. Disponible: ${product.cantidad_stock}`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item =>
        item.producto_id === product.id
          ? { ...item, cantidad: newTotalQuantity, subtotal: product.precio_unitario * newTotalQuantity }
          : item
      ));
    } else {
      setCart([...cart, {
        producto_id: product.id,
        producto_nombre: product.nombre,
        cantidad: quantity,
        precio_unitario: product.precio_unitario,
        subtotal: product.precio_unitario * quantity,
        unidad: product.unidad_medida,
        stock_disponible: product.cantidad_stock
      }]);
    }

    setQuantityModal({ open: false, product: null, quantity: 1 });
    toast.success(`${product.nombre} agregado`);
  };

  const quickAddToCart = (product) => {
    const existingItem = cart.find(item => item.producto_id === product.id);
    const currentQuantity = existingItem ? existingItem.cantidad : 0;

    if (currentQuantity + 1 > product.cantidad_stock) {
      toast.error(`Stock insuficiente`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item =>
        item.producto_id === product.id
          ? { ...item, cantidad: currentQuantity + 1, subtotal: product.precio_unitario * (currentQuantity + 1) }
          : item
      ));
    } else {
      setCart([...cart, {
        producto_id: product.id,
        producto_nombre: product.nombre,
        cantidad: 1,
        precio_unitario: product.precio_unitario,
        subtotal: product.precio_unitario,
        unidad: product.unidad_medida,
        stock_disponible: product.cantidad_stock
      }]);
    }
    toast.success(`+1 ${product.nombre}`);
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > product.cantidad_stock) {
      toast.error(`Stock insuficiente. Disponible: ${product.cantidad_stock}`);
      return;
    }

    setCart(cart.map(item =>
      item.producto_id === productId
        ? { ...item, cantidad: newQuantity, subtotal: product.precio_unitario * newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.producto_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashReceived('');
    setError('');
    setDescuentoTipo(null);
    setDescuentoValor('');
    setShowDiscount(false);
    setSelectedCustomer(null);
    setCustomerSearch('');
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getDescuentoMonto = () => {
    const subtotal = getSubtotal();
    if (!descuentoTipo || !descuentoValor) return 0;
    const valor = parseFloat(descuentoValor) || 0;
    if (descuentoTipo === 'porcentaje') {
      return (subtotal * valor) / 100;
    }
    return Math.min(valor, subtotal);
  };

  const getTotal = () => {
    return Math.max(0, getSubtotal() - getDescuentoMonto());
  };

  const getChange = () => {
    if (paymentMethod !== 'efectivo') return null;
    const cash = parseFloat(cashReceived) || 0;
    const total = getTotal();
    return cash >= total ? cash - total : null;
  };

  const filteredCustomers = customers.filter(c =>
    c.nombre.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.telefono && c.telefono.includes(customerSearch))
  );

  const buildWhatsAppLink = (sale, customer) => {
    const phone = customer?.telefono?.replace(/\D/g, '');
    if (!phone) return null;
    const lines = [
      '🧾 *Recibo de Venta*',
      `Fecha: ${formatDate(sale.fecha_venta)}`,
      '',
      ...sale.items.map(item => `• ${item.producto_nombre} x${item.cantidad_vendida} — ${formatCurrency(item.subtotal)}`),
      '',
      sale.monto_descuento > 0 ? `Subtotal: ${formatCurrency(sale.monto_subtotal)}` : '',
      sale.monto_descuento > 0 ? `Descuento: -${formatCurrency(sale.monto_descuento)}` : '',
      `*Total: ${formatCurrency(sale.monto_total)}*`,
      `Pago: ${sale.metodo_pago}`,
      sale.cambio != null ? `Cambio: ${formatCurrency(sale.cambio)}` : ''
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${phone}?text=${text}`;
  };

  const completeSale = async () => {
    setError('');

    if (cart.length === 0) {
      setError('El carrito está vacío');
      return;
    }

    if (paymentMethod === 'efectivo') {
      const cash = parseFloat(cashReceived) || 0;
      if (cash < getTotal()) {
        setError('El monto recibido es menor al total');
        return;
      }
    }

    if (paymentMethod === 'fiado' && !selectedCustomer) {
      setError('Debes seleccionar un cliente para ventas a crédito');
      return;
    }

    setIsProcessing(true);

    try {
      const payload = {
        items: cart.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad
        })),
        metodo_pago: paymentMethod,
        monto_recibido: paymentMethod === 'efectivo' ? parseFloat(cashReceived) : null,
        cliente_id: selectedCustomer?.id || null,
        descuento_tipo: descuentoTipo || null,
        descuento_valor: descuentoTipo && descuentoValor ? parseFloat(descuentoValor) : null,
      };

      const response = await api.post('/api/sales', payload);

      const saleData = response.data;
      saleData.clienteRef = selectedCustomer;

      setLastSale(saleData);
      setShowReceipt(true);
      setCart([]);
      setCashReceived('');
      setPaymentMethod('efectivo');
      setDescuentoTipo(null);
      setDescuentoValor('');
      setShowDiscount(false);
      setSelectedCustomer(null);
      setCustomerSearch('');
      fetchProducts();
      toast.success('Venta completada');
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="sales-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  const descuentoMonto = getDescuentoMonto();
  const subtotal = getSubtotal();
  const total = getTotal();
  const creditoDisponible = selectedCustomer
    ? (selectedCustomer.limite_credito > 0
        ? selectedCustomer.limite_credito - selectedCustomer.saldo_pendiente
        : null)
    : null;
  const excedeCreditro = selectedCustomer && selectedCustomer.limite_credito > 0
    && (selectedCustomer.saldo_pendiente + total) > selectedCustomer.limite_credito;

  return (
    <div className="space-y-4" data-testid="sales-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-zinc-900">Punto de Venta</h1>
          <p className="text-zinc-500 text-sm mt-1">Selecciona productos para vender</p>
        </div>
        {cart.length > 0 && (
          <Button variant="outline" onClick={clearCart} className="text-rose-600 border-rose-200 hover:bg-rose-50">
            Limpiar carrito
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Barcode Input */}
          <div className="relative">
            <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              ref={barcodeRef}
              type="text"
              placeholder="Escanear código de barras..."
              value={barcodeInput}
              onChange={handleBarcodeChange}
              onKeyDown={handleBarcodeKeyDown}
              className="pl-10 input-swiss"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-swiss"
              data-testid="product-search-input"
            />
          </div>

          {/* Category Tabs */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 text-sm rounded-sm border transition-all ${
                  selectedCategory === null
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                }`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1 text-sm rounded-sm border transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="products-grid">
            {filteredProducts.map((product) => {
              const inCart = cart.find(item => item.producto_id === product.id);
              return (
                <div
                  key={product.id}
                  className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${getStockColor(product.stock_status)} ${inCart ? 'ring-2 ring-zinc-900' : ''}`}
                  onClick={() => quickAddToCart(product)}
                  onContextMenu={(e) => { e.preventDefault(); openQuantityModal(product); }}
                  data-testid={`product-card-${product.id}`}
                >
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getStockBadgeColor(product.stock_status)}`} />

                  {inCart && (
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {inCart.cantidad}
                    </div>
                  )}

                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-white rounded-lg flex items-center justify-center border border-zinc-200">
                      <Package className="h-6 w-6 text-zinc-400" />
                    </div>
                    <p className="text-sm font-medium text-zinc-900 truncate" title={product.nombre}>
                      {product.nombre}
                    </p>
                    <p className="text-lg font-bold text-zinc-900 mt-1">
                      {formatCurrency(product.precio_unitario)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Stock: {product.cantidad_stock} {product.unidad_medida}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              <Package className="h-12 w-12 mx-auto mb-3" />
              <p>{searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}</p>
            </div>
          )}

          <p className="text-xs text-zinc-400 text-center">
            Clic = agregar 1 | Clic derecho = elegir cantidad
          </p>
        </div>

        {/* Cart & Payment */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* Cart */}
          <Card className="card-swiss">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length > 0 ? (
                <div className="space-y-2" data-testid="cart-items">
                  {cart.map((item) => (
                    <div key={item.producto_id} className="flex items-center gap-2 p-2 bg-zinc-50 rounded-sm" data-testid={`cart-item-${item.producto_id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{item.producto_nombre}</p>
                        <p className="text-xs text-zinc-500">{formatCurrency(item.precio_unitario)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => updateCartItemQuantity(item.producto_id, item.cantidad - 1)}
                          data-testid={`cart-decrease-${item.producto_id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => updateCartItemQuantity(item.producto_id, item.cantidad + 1)}
                          data-testid={`cart-increase-${item.producto_id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-rose-600"
                          onClick={() => removeFromCart(item.producto_id)}
                          data-testid={`cart-remove-${item.producto_id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm font-semibold w-20 text-right">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}

                  <div className="border-t border-zinc-200 pt-3 mt-3">
                    {descuentoMonto > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-500">Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    )}
                    {descuentoMonto > 0 && (
                      <div className="flex justify-between text-sm mb-1 text-rose-600">
                        <span>Descuento:</span>
                        <span>-{formatCurrency(descuentoMonto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span data-testid="cart-total">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {/* Descuento Section */}
                  <div className="border-t border-zinc-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDiscount(!showDiscount)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 w-full"
                    >
                      {showDiscount ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Descuento
                    </button>
                    {showDiscount && (
                      <div className="mt-2 space-y-2 p-2 bg-zinc-50 rounded-sm">
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="descuentoTipo"
                              value="porcentaje"
                              checked={descuentoTipo === 'porcentaje'}
                              onChange={() => setDescuentoTipo('porcentaje')}
                              className="accent-zinc-900"
                            />
                            Porcentaje %
                          </label>
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="descuentoTipo"
                              value="monto_fijo"
                              checked={descuentoTipo === 'monto_fijo'}
                              onChange={() => setDescuentoTipo('monto_fijo')}
                              className="accent-zinc-900"
                            />
                            Monto fijo $
                          </label>
                        </div>
                        {descuentoTipo && (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={descuentoValor}
                            onChange={(e) => setDescuentoValor(e.target.value)}
                            placeholder={descuentoTipo === 'porcentaje' ? '0 %' : '0.00'}
                            className="input-swiss h-8 text-sm"
                          />
                        )}
                        {descuentoMonto > 0 && (
                          <p className="text-xs text-rose-600">
                            Descuento: -{formatCurrency(descuentoMonto)} → Total: {formatCurrency(total)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-400" data-testid="empty-cart">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Carrito vacío</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          {cart.length > 0 && (
            <Card className="card-swiss" data-testid="payment-section">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-heading">Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <div key={method.value}>
                      <RadioGroupItem
                        value={method.value}
                        id={method.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={method.value}
                        className="flex flex-col items-center justify-center p-3 border border-zinc-200 rounded-sm cursor-pointer hover:border-zinc-300 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-zinc-50 transition-all text-center"
                        data-testid={`payment-method-${method.value}`}
                      >
                        <method.icon className="h-5 w-5 mb-1" />
                        <span className="text-xs font-medium">{method.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {paymentMethod === 'efectivo' && (
                  <div className="space-y-3 p-3 bg-zinc-50 rounded-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Total:</span>
                      <span className="font-bold">{formatCurrency(total)}</span>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Monto Recibido</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="0.00"
                        className="input-swiss mt-1"
                        data-testid="cash-received-input"
                      />
                    </div>
                    {getChange() !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Cambio:</span>
                        <span className="font-bold text-emerald-600" data-testid="change-amount">
                          {formatCurrency(getChange())}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'fiado' && (
                  <div className="space-y-2 p-3 bg-zinc-50 rounded-sm">
                    <Label className="text-xs text-zinc-500">Buscar cliente</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                          if (!e.target.value) setSelectedCustomer(null);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        placeholder="Nombre o teléfono..."
                        className="input-swiss h-8 text-sm"
                      />
                      {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 bg-white border border-zinc-200 rounded-sm shadow-md max-h-40 overflow-y-auto">
                          {filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setCustomerSearch(c.nombre);
                                setShowCustomerDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                            >
                              <span className="font-medium">{c.nombre}</span>
                              {c.telefono && <span className="text-zinc-400 ml-2">{c.telefono}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedCustomer && (
                      <div className="text-xs space-y-1 mt-1">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Saldo pendiente:</span>
                          <span className={selectedCustomer.saldo_pendiente > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
                            {formatCurrency(selectedCustomer.saldo_pendiente)}
                          </span>
                        </div>
                        {selectedCustomer.limite_credito > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Límite de crédito:</span>
                            <span>{formatCurrency(selectedCustomer.limite_credito)}</span>
                          </div>
                        )}
                        {excedeCreditro && (
                          <div className="flex items-center gap-1 text-rose-600 bg-rose-50 p-2 rounded-sm">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            <span>Esta venta excede el límite de crédito del cliente</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm" data-testid="sale-error">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button
                  onClick={completeSale}
                  disabled={isProcessing || cart.length === 0}
                  className="btn-primary w-full py-5 text-base"
                  data-testid="complete-sale-button"
                >
                  {isProcessing ? 'Procesando...' : `Cobrar ${formatCurrency(total)}`}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quantity Modal */}
      <Dialog open={quantityModal.open} onOpenChange={(open) => setQuantityModal({ ...quantityModal, open })}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-heading">{quantityModal.product?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{formatCurrency(quantityModal.product?.precio_unitario || 0)}</p>
              <p className="text-sm text-zinc-500">
                Disponible: {quantityModal.maxAvailable} {quantityModal.product?.unidad_medida}
              </p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-12 p-0"
                onClick={() => setQuantityModal(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                type="number"
                min="1"
                max={quantityModal.maxAvailable}
                value={quantityModal.quantity}
                onChange={(e) => setQuantityModal(prev => ({
                  ...prev,
                  quantity: Math.min(prev.maxAvailable, Math.max(1, parseInt(e.target.value) || 1))
                }))}
                className="w-20 text-center text-xl font-bold input-swiss"
              />
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-12 p-0"
                onClick={() => setQuantityModal(prev => ({
                  ...prev,
                  quantity: Math.min(prev.maxAvailable, prev.quantity + 1)
                }))}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-center text-lg font-bold">
              Subtotal: {formatCurrency((quantityModal.product?.precio_unitario || 0) * quantityModal.quantity)}
            </div>
            <Button onClick={addToCartFromModal} className="btn-primary w-full">
              Agregar al carrito
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Venta Completada
            </DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-4" data-testid="sale-receipt">
              <div className="text-center py-4 border-b border-zinc-100">
                <p className="text-3xl font-bold text-zinc-900">{formatCurrency(lastSale.monto_total)}</p>
                <p className="text-sm text-zinc-500 mt-1">{formatDate(lastSale.fecha_venta)}</p>
                {lastSale.clienteRef && (
                  <p className="text-sm text-zinc-600 mt-1">{lastSale.clienteRef.nombre}</p>
                )}
              </div>

              <div className="space-y-2">
                {lastSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.producto_nombre} x{item.cantidad_vendida}</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-200 pt-4 space-y-2">
                {lastSale.monto_descuento > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(lastSale.monto_subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-rose-600">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(lastSale.monto_descuento)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Método de Pago:</span>
                  <span className="capitalize">{lastSale.metodo_pago}</span>
                </div>
                {lastSale.cambio !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Cambio:</span>
                    <span className="text-emerald-600 font-medium">{formatCurrency(lastSale.cambio)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setShowReceipt(false)} className="btn-primary flex-1">
                  Nueva Venta
                </Button>
                {(() => {
                  const waLink = buildWhatsAppLink(lastSale, lastSale.clienteRef);
                  return waLink ? (
                    <Button
                      variant="outline"
                      onClick={() => window.open(waLink, '_blank')}
                      className="flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  ) : null;
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
