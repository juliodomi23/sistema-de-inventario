import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'gramos', label: 'Gramos (g)' },
  { value: 'L', label: 'Litros (L)' },
  { value: 'piezas', label: 'Piezas' },
  { value: 'bolsas', label: 'Bolsas' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'metros', label: 'Metros' },
];

const initialFormState = {
  nombre: '',
  precio_unitario: '',
  unidad_medida: 'piezas',
  cantidad_stock: '',
  cantidad_minima: '',
  codigo_barras: '',
  categoria_id: '',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value) => {
    setFormData(prev => ({ ...prev, unidad_medida: value }));
  };

  const handleCategoryChange = (value) => {
    setFormData(prev => ({ ...prev, categoria_id: value === '_none' ? '' : value }));
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setError('');
  };

  const openEditDialog = (product) => {
    setFormData({
      nombre: product.nombre,
      precio_unitario: product.precio_unitario.toString(),
      unidad_medida: product.unidad_medida,
      cantidad_stock: product.cantidad_stock.toString(),
      cantidad_minima: product.cantidad_minima.toString(),
      codigo_barras: product.codigo_barras || '',
      categoria_id: product.categoria_id || '',
    });
    setEditingId(product.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Validation
    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      nombre: formData.nombre,
      precio_unitario: parseFloat(formData.precio_unitario),
      unidad_medida: formData.unidad_medida,
      cantidad_stock: parseFloat(formData.cantidad_stock),
      cantidad_minima: parseFloat(formData.cantidad_minima),
      codigo_barras: formData.codigo_barras || null,
      categoria_id: formData.categoria_id || null,
    };

    if (isNaN(payload.precio_unitario) || payload.precio_unitario <= 0) {
      setError('El precio debe ser mayor a 0');
      setIsSubmitting(false);
      return;
    }

    if (isNaN(payload.cantidad_stock) || payload.cantidad_stock < 0) {
      setError('La cantidad en stock no puede ser negativa');
      setIsSubmitting(false);
      return;
    }

    if (isNaN(payload.cantidad_minima) || payload.cantidad_minima < 0) {
      setError('La cantidad mínima no puede ser negativa');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingId) {
        await api.put(`/api/products/${editingId}`, payload);
        toast.success('Producto actualizado');
      } else {
        await api.post('/api/products', payload);
        toast.success('Producto creado');
      }
      fetchProducts();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al guardar producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await api.delete(`/api/products/${productToDelete.id}`);
      toast.success('Producto eliminado');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar producto');
    } finally {
      setProductToDelete(null);
    }
  };

  const getStockBadge = (status) => {
    const styles = {
      green: 'bg-emerald-500 text-white',
      yellow: 'bg-amber-500 text-black',
      red: 'bg-rose-500 text-white',
    };
    const labels = {
      green: 'Óptimo',
      yellow: 'Medio',
      red: 'Bajo',
    };
    return (
      <span 
        className={`status-badge ${styles[status]}`}
        data-testid={`stock-status-indicator-${status}`}
      >
        {labels[status]}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="products-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="products-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-zinc-900">Productos</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestiona tu inventario de productos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="btn-primary" data-testid="add-product-button">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4" data-testid="product-form">
              <div className="form-group">
                <Label htmlFor="nombre" className="form-label">Nombre *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  placeholder="Nombre del producto"
                  className="input-swiss"
                  data-testid="product-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <Label htmlFor="precio_unitario" className="form-label">Precio (MXN) *</Label>
                  <Input
                    id="precio_unitario"
                    name="precio_unitario"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_unitario}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="input-swiss"
                    data-testid="product-price-input"
                  />
                </div>

                <div className="form-group">
                  <Label htmlFor="unidad_medida" className="form-label">Unidad *</Label>
                  <Select value={formData.unidad_medida} onValueChange={handleSelectChange}>
                    <SelectTrigger className="input-swiss" data-testid="product-unit-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <Label htmlFor="codigo_barras" className="form-label">Código de barras</Label>
                  <Input
                    id="codigo_barras"
                    name="codigo_barras"
                    value={formData.codigo_barras}
                    onChange={handleInputChange}
                    placeholder="Opcional"
                    className="input-swiss"
                  />
                </div>

                <div className="form-group">
                  <Label htmlFor="categoria_id" className="form-label">Categoría</Label>
                  <Select value={formData.categoria_id || '_none'} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="input-swiss">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin categoría</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <Label htmlFor="cantidad_stock" className="form-label">Stock Actual *</Label>
                  <Input
                    id="cantidad_stock"
                    name="cantidad_stock"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cantidad_stock}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="input-swiss"
                    data-testid="product-stock-input"
                  />
                </div>

                <div className="form-group">
                  <Label htmlFor="cantidad_minima" className="form-label">Stock Mínimo *</Label>
                  <Input
                    id="cantidad_minima"
                    name="cantidad_minima"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cantidad_minima}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="input-swiss"
                    data-testid="product-min-stock-input"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm" data-testid="product-form-error">
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
                <Button type="submit" className="btn-primary" disabled={isSubmitting} data-testid="product-submit-button">
                  {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Table */}
      <Card className="card-swiss">
        <CardContent className="p-0">
          {products.length > 0 ? (
            <Table data-testid="products-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Producto</TableHead>
                  <TableHead className="table-header">Categoría</TableHead>
                  <TableHead className="table-header">Precio</TableHead>
                  <TableHead className="table-header">Stock</TableHead>
                  <TableHead className="table-header">Mínimo</TableHead>
                  <TableHead className="table-header">Estado</TableHead>
                  <TableHead className="table-header text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-zinc-900">{product.nombre}</p>
                        <p className="text-xs text-zinc-500">{product.unidad_medida}</p>
                        {product.codigo_barras && (
                          <p className="text-xs text-zinc-400 font-mono">{product.codigo_barras}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-600">
                        {product.categoria_nombre || <span className="text-zinc-400">—</span>}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(product.precio_unitario)}</TableCell>
                    <TableCell>{product.cantidad_stock}</TableCell>
                    <TableCell>{product.cantidad_minima}</TableCell>
                    <TableCell>{getStockBadge(product.stock_status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(product)}
                          className="h-8 w-8 p-0"
                          data-testid={`product-edit-button-${product.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProductToDelete(product)}
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          data-testid={`product-delete-button-${product.id}`}
                          aria-label={`Eliminar ${product.nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state py-16" data-testid="no-products">
              <Package className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium text-zinc-600">No hay productos</p>
              <p className="text-sm text-zinc-400 mt-1">Agrega tu primer producto para comenzar</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">¿Eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{productToDelete?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
