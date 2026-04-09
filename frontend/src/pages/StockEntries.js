import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { Plus, PackagePlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format';

const initialFormState = {
  producto_id: '',
  cantidad: '',
  costo_unitario: '',
  notas: '',
};

export default function StockEntries() {
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(initialFormState);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchEntries();
    fetchProducts();
  }, []);

  const fetchEntries = async () => {
    try {
      const response = await api.get('/api/stock-entries');
      setEntries(response.data);
    } catch (err) {
      toast.error('Error al cargar entradas');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (value) => {
    setFormData(prev => ({ ...prev, producto_id: value }));
    const product = products.find(p => p.id === value);
    setSelectedProduct(product || null);
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setSelectedProduct(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.producto_id) {
      setError('Debes seleccionar un producto');
      return;
    }

    const cantidad = parseFloat(formData.cantidad);
    if (!cantidad || cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      producto_id: formData.producto_id,
      cantidad,
      costo_unitario: formData.costo_unitario ? parseFloat(formData.costo_unitario) : null,
      notas: formData.notas.trim() || null,
    };

    try {
      await api.post('/api/stock-entries', payload);
      toast.success('Entrada registrada');
      fetchEntries();
      fetchProducts();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrar entrada');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-zinc-900">Entradas de Stock</h1>
          <p className="text-zinc-500 text-sm mt-1">Registra entradas de mercancía al inventario</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Entrada
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Nueva Entrada de Stock</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="form-group">
                <Label htmlFor="producto_id" className="form-label">Producto *</Label>
                <Select value={formData.producto_id} onValueChange={handleProductChange}>
                  <SelectTrigger className="input-swiss">
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Stock actual: <span className="font-medium text-zinc-700">{selectedProduct.cantidad_stock} {selectedProduct.unidad_medida}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <Label htmlFor="cantidad" className="form-label">Cantidad *</Label>
                  <Input
                    id="cantidad"
                    name="cantidad"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.cantidad}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="input-swiss"
                  />
                </div>

                <div className="form-group">
                  <Label htmlFor="costo_unitario" className="form-label">Costo unitario</Label>
                  <Input
                    id="costo_unitario"
                    name="costo_unitario"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costo_unitario}
                    onChange={handleInputChange}
                    placeholder="Opcional"
                    className="input-swiss"
                  />
                </div>
              </div>

              <div className="form-group">
                <Label htmlFor="notas" className="form-label">Notas</Label>
                <Textarea
                  id="notas"
                  name="notas"
                  value={formData.notas}
                  onChange={handleInputChange}
                  placeholder="Notas opcionales (proveedor, factura, etc.)"
                  className="input-swiss resize-none"
                  rows={2}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="rounded-sm">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Registrar entrada'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-swiss">
        <CardHeader>
          <CardTitle className="font-heading text-base">Historial de entradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Producto</TableHead>
                  <TableHead className="table-header">Cantidad</TableHead>
                  <TableHead className="table-header">Costo unitario</TableHead>
                  <TableHead className="table-header">Notas</TableHead>
                  <TableHead className="table-header">Usuario</TableHead>
                  <TableHead className="table-header">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-zinc-900">{entry.producto_nombre}</TableCell>
                    <TableCell>
                      <span className="text-emerald-600 font-medium">+{entry.cantidad}</span>
                      {entry.unidad_medida && (
                        <span className="text-zinc-400 text-xs ml-1">{entry.unidad_medida}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {entry.costo_unitario ? formatCurrency(entry.costo_unitario) : <span className="text-zinc-300">—</span>}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm max-w-xs truncate">
                      {entry.notas || <span className="text-zinc-300">—</span>}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">{entry.usuario_nombre || '—'}</TableCell>
                    <TableCell className="text-zinc-500 text-sm">{formatDate(entry.fecha)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state py-16">
              <PackagePlus className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium text-zinc-600">No hay entradas registradas</p>
              <p className="text-sm text-zinc-400 mt-1">Registra la primera entrada de stock</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
