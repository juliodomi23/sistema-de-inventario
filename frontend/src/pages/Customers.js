import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';
import { Plus, Pencil, Trash2, Users2, AlertCircle, History, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '../utils/format';

const initialFormState = {
  nombre: '',
  telefono: '',
  email: '',
  limite_credito: '',
  notas: '',
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // Historial de ventas
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [customerSales, setCustomerSales] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Registrar pago
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/api/customers');
      setCustomers(response.data);
    } catch (err) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setError('');
  };

  const openEditDialog = (customer) => {
    setFormData({
      nombre: customer.nombre,
      telefono: customer.telefono || '',
      email: customer.email || '',
      limite_credito: customer.limite_credito?.toString() || '',
      notas: customer.notas || '',
    });
    setEditingId(customer.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      nombre: formData.nombre.trim(),
      telefono: formData.telefono.trim() || null,
      email: formData.email.trim() || null,
      limite_credito: formData.limite_credito ? parseFloat(formData.limite_credito) : 0,
      notas: formData.notas.trim() || null,
    };

    try {
      if (editingId) {
        await api.put(`/api/customers/${editingId}`, payload);
        toast.success('Cliente actualizado');
      } else {
        await api.post('/api/customers', payload);
        toast.success('Cliente creado');
      }
      fetchCustomers();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    try {
      await api.delete(`/api/customers/${customerToDelete.id}`);
      toast.success('Cliente eliminado');
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar cliente');
    } finally {
      setCustomerToDelete(null);
    }
  };

  const openHistory = async (customer) => {
    setHistoryCustomer(customer);
    setLoadingHistory(true);
    try {
      const response = await api.get(`/api/customers/${customer.id}/sales`);
      setCustomerSales(response.data);
    } catch (err) {
      toast.error('Error al cargar historial');
      setCustomerSales([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePayment = async () => {
    setPaymentError('');
    const monto = parseFloat(paymentAmount);
    if (!monto || monto <= 0) {
      setPaymentError('El monto debe ser mayor a 0');
      return;
    }
    if (monto > paymentCustomer.saldo_pendiente) {
      setPaymentError('El monto no puede ser mayor al saldo pendiente');
      return;
    }

    setIsPaymentSubmitting(true);
    try {
      await api.post(`/api/customers/${paymentCustomer.id}/payments`, { monto });
      toast.success('Pago registrado');
      setPaymentCustomer(null);
      setPaymentAmount('');
      fetchCustomers();
    } catch (err) {
      setPaymentError(err.response?.data?.detail || 'Error al registrar pago');
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const getSaldoStyle = (customer) => {
    if (customer.saldo_pendiente === 0) return 'text-emerald-600';
    if (customer.limite_credito > 0 && customer.saldo_pendiente >= customer.limite_credito) {
      return 'text-rose-600 font-medium';
    }
    return 'text-amber-600';
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
          <h1 className="text-2xl font-heading text-zinc-900">Clientes</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestiona tus clientes y su crédito</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="form-group">
                <Label htmlFor="nombre" className="form-label">Nombre *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  placeholder="Nombre del cliente"
                  className="input-swiss"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <Label htmlFor="telefono" className="form-label">Teléfono</Label>
                  <Input
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    placeholder="Opcional"
                    className="input-swiss"
                  />
                </div>
                <div className="form-group">
                  <Label htmlFor="email" className="form-label">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Opcional"
                    className="input-swiss"
                  />
                </div>
              </div>

              <div className="form-group">
                <Label htmlFor="limite_credito" className="form-label">Límite de crédito (MXN)</Label>
                <Input
                  id="limite_credito"
                  name="limite_credito"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.limite_credito}
                  onChange={handleInputChange}
                  placeholder="0 = sin límite"
                  className="input-swiss"
                />
              </div>

              <div className="form-group">
                <Label htmlFor="notas" className="form-label">Notas</Label>
                <Textarea
                  id="notas"
                  name="notas"
                  value={formData.notas}
                  onChange={handleInputChange}
                  placeholder="Notas opcionales"
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
                  {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-swiss">
        <CardContent className="p-0">
          {customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Nombre</TableHead>
                  <TableHead className="table-header">Teléfono</TableHead>
                  <TableHead className="table-header">Email</TableHead>
                  <TableHead className="table-header">Crédito disponible</TableHead>
                  <TableHead className="table-header">Saldo pendiente</TableHead>
                  <TableHead className="table-header text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const creditoDisponible = customer.limite_credito > 0
                    ? customer.limite_credito - customer.saldo_pendiente
                    : null;
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <button
                          onClick={() => openHistory(customer)}
                          className="font-medium text-zinc-900 hover:text-zinc-600 hover:underline text-left"
                        >
                          {customer.nombre}
                        </button>
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm">
                        {customer.telefono || <span className="text-zinc-300">—</span>}
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm">
                        {customer.email || <span className="text-zinc-300">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {creditoDisponible != null
                          ? <span className={creditoDisponible <= 0 ? 'text-rose-600' : 'text-zinc-700'}>{formatCurrency(creditoDisponible)}</span>
                          : <span className="text-zinc-400">Sin límite</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${getSaldoStyle(customer)}`}>
                          {formatCurrency(customer.saldo_pendiente)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHistory(customer)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-700"
                            title="Ver historial"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {customer.saldo_pendiente > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setPaymentCustomer(customer); setPaymentAmount(''); setPaymentError(''); }}
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Registrar pago"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(customer)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {customer.saldo_pendiente === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCustomerToDelete(customer)}
                              className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state py-16">
              <Users2 className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium text-zinc-600">No hay clientes</p>
              <p className="text-sm text-zinc-400 mt-1">Agrega tu primer cliente para comenzar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de ventas del cliente */}
      <Dialog open={!!historyCustomer} onOpenChange={(open) => !open && setHistoryCustomer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Historial de {historyCustomer?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {loadingHistory ? (
              <p className="text-zinc-500 text-sm text-center py-8">Cargando...</p>
            ) : customerSales.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customerSales.map((sale, idx) => (
                  <div key={idx} className="p-3 border border-zinc-100 rounded-sm">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">{formatDate(sale.fecha_venta)}</span>
                      <span className="font-bold">{formatCurrency(sale.monto_total)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span className="capitalize">{sale.metodo_pago}</span>
                      <span className={sale.estado === 'anulada' ? 'text-rose-500' : 'text-emerald-500'}>
                        {sale.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm text-center py-8">Sin ventas registradas</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog registrar pago */}
      <Dialog open={!!paymentCustomer} onOpenChange={(open) => !open && setPaymentCustomer(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Registrar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {paymentCustomer && (
              <div className="p-3 bg-zinc-50 rounded-sm text-sm">
                <p className="font-medium text-zinc-900">{paymentCustomer.nombre}</p>
                <p className="text-zinc-500 mt-1">
                  Saldo pendiente: <span className="text-amber-600 font-medium">{formatCurrency(paymentCustomer.saldo_pendiente)}</span>
                </p>
              </div>
            )}

            <div className="form-group">
              <Label htmlFor="paymentAmount" className="form-label">Monto a pagar *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={paymentCustomer?.saldo_pendiente}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="input-swiss"
                autoFocus
              />
            </div>

            {paymentError && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 p-3 rounded-sm">
                <AlertCircle className="h-4 w-4" />
                {paymentError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setPaymentCustomer(null)}
                className="rounded-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isPaymentSubmitting}
                className="btn-primary"
              >
                {isPaymentSubmitting ? 'Registrando...' : 'Registrar pago'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Eliminar cliente */}
      <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente a <strong>{customerToDelete?.nombre}</strong>. Esta acción no se puede deshacer.
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
