import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, ArrowRightLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'transferencia', label: 'Transferencia', icon: ArrowRightLeft },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/products`, {
        withCredentials: true
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const getProductById = (id) => products.find(p => p.id === id);

  const addToCart = () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    const product = getProductById(selectedProduct);
    if (!product) return;

    const existingItem = cart.find(item => item.producto_id === selectedProduct);
    const currentQuantity = existingItem ? existingItem.cantidad : 0;
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > product.cantidad_stock) {
      toast.error(`Stock insuficiente. Disponible: ${product.cantidad_stock}`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item => 
        item.producto_id === selectedProduct
          ? { ...item, cantidad: newTotalQuantity, subtotal: product.precio_unitario * newTotalQuantity }
          : item
      ));
    } else {
      setCart([...cart, {
        producto_id: selectedProduct,
        producto_nombre: product.nombre,
        cantidad: quantity,
        precio_unitario: product.precio_unitario,
        subtotal: product.precio_unitario * quantity,
        unidad: product.unidad_medida,
        stock_disponible: product.cantidad_stock
      }]);
    }

    setSelectedProduct('');
    setQuantity(1);
    toast.success('Producto agregado');
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    const product = getProductById(productId);
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

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getChange = () => {
    if (paymentMethod !== 'efectivo') return null;
    const cash = parseFloat(cashReceived) || 0;
    const total = getTotal();
    return cash >= total ? cash - total : null;
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

    setIsProcessing(true);

    try {
      const payload = {
        items: cart.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad
        })),
        metodo_pago: paymentMethod,
        monto_recibido: paymentMethod === 'efectivo' ? parseFloat(cashReceived) : null
      };

      const response = await axios.post(`${API_URL}/api/sales`, payload, {
        withCredentials: true
      });

      setLastSale(response.data);
      setShowReceipt(true);
      setCart([]);
      setCashReceived('');
      setPaymentMethod('efectivo');
      fetchProducts(); // Refresh products to update stock
      toast.success('Venta completada');
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="sales-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sales-container">
      <div>
        <h1 className="text-2xl font-heading text-zinc-900">Punto de Venta</h1>
        <p className="text-zinc-500 text-sm mt-1">Registra nuevas ventas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <Card className="card-swiss lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Agregar Productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="form-label">Producto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="input-swiss" data-testid="pos-product-select">
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem 
                        key={product.id} 
                        value={product.id}
                        disabled={product.cantidad_stock <= 0}
                      >
                        <div className="flex justify-between w-full">
                          <span>{product.nombre}</span>
                          <span className="text-zinc-500 ml-4">
                            {formatCurrency(product.precio_unitario)} • Stock: {product.cantidad_stock}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="form-label">Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  className="input-swiss"
                  data-testid="pos-quantity-input"
                />
              </div>
            </div>

            <Button 
              onClick={addToCart} 
              className="btn-primary w-full md:w-auto"
              data-testid="pos-add-to-cart-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar al Carrito
            </Button>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrito ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length > 0 ? (
              <div className="space-y-3" data-testid="cart-items">
                {cart.map((item) => (
                  <div key={item.producto_id} className="cart-item" data-testid={`cart-item-${item.producto_id}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900">{item.producto_nombre}</p>
                      <p className="text-xs text-zinc-500">
                        {formatCurrency(item.precio_unitario)} x {item.cantidad} {item.unidad}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateCartItemQuantity(item.producto_id, item.cantidad - 1)}
                        data-testid={`cart-decrease-${item.producto_id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">{item.cantidad}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
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
                    <p className="text-sm font-semibold w-24 text-right">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
                <div className="cart-total flex justify-between">
                  <span>Total:</span>
                  <span data-testid="cart-total">{formatCurrency(getTotal())}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state py-8" data-testid="empty-cart">
                <ShoppingCart className="h-8 w-8 mb-2" />
                <p className="text-sm">Carrito vacío</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Section */}
      {cart.length > 0 && (
        <Card className="card-swiss" data-testid="payment-section">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Método de Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-3 gap-4">
              {PAYMENT_METHODS.map((method) => (
                <div key={method.value}>
                  <RadioGroupItem
                    value={method.value}
                    id={method.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={method.value}
                    className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-sm cursor-pointer hover:border-zinc-300 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-zinc-50 transition-all"
                    data-testid={`payment-method-${method.value}`}
                  >
                    <method.icon className="h-6 w-6 mb-2" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {paymentMethod === 'efectivo' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50 rounded-sm">
                <div>
                  <Label className="form-label">Total a Pagar</Label>
                  <p className="text-2xl font-semibold text-zinc-900">{formatCurrency(getTotal())}</p>
                </div>
                <div>
                  <Label htmlFor="cashReceived" className="form-label">Monto Recibido</Label>
                  <Input
                    id="cashReceived"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="input-swiss"
                    data-testid="cash-received-input"
                  />
                </div>
                <div>
                  <Label className="form-label">Cambio</Label>
                  <p className={`text-2xl font-semibold ${getChange() !== null ? 'text-emerald-600' : 'text-zinc-300'}`} data-testid="change-amount">
                    {getChange() !== null ? formatCurrency(getChange()) : '—'}
                  </p>
                </div>
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
              className="btn-primary w-full py-6 text-lg"
              data-testid="complete-sale-button"
            >
              {isProcessing ? 'Procesando...' : `Completar Venta • ${formatCurrency(getTotal())}`}
            </Button>
          </CardContent>
        </Card>
      )}

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

              <Button onClick={() => setShowReceipt(false)} className="btn-primary w-full">
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
