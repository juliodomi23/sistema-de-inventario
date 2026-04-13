import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { History, XCircle, Eye, CheckCircle, AlertTriangle, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [isCanceling, setIsCanceling] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async (applyFilters = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (applyFilters) {
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (statusFilter !== 'todas') params.append('status', statusFilter);
      }
      
      const response = await api.get(`/api/reports/sales?${params.toString()}`);
      setSales(response.data.sales);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    fetchSales(true);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('todas');
    fetchSales(false);
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    
    setIsCanceling(true);
    try {
      await api.post(`/api/sales/${saleToCancel.id}/cancel`, {});
      toast.success('Venta anulada exitosamente. Stock restaurado.');
      fetchSales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al anular venta');
    } finally {
      setIsCanceling(false);
      setSaleToCancel(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(dateString) ? dateString : dateString + 'Z';
    return new Date(normalized).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City',
    });
  };

  const getStatusBadge = (estado) => {
    if (estado === 'anulada') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-medium bg-rose-100 text-rose-700" data-testid="sale-status-cancelled">
          <XCircle className="h-3 w-3" />
          Anulada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-medium bg-emerald-100 text-emerald-700" data-testid="sale-status-completed">
        <CheckCircle className="h-3 w-3" />
        Completada
      </span>
    );
  };

  const getPaymentBadge = (metodo) => {
    const labels = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta: 'Tarjeta',
    };
    return (
      <span className="px-2 py-0.5 rounded-sm text-xs font-medium uppercase tracking-wide bg-zinc-100 text-zinc-700">
        {labels[metodo] || metodo}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="sales-history-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sales-history-container">
      <div>
        <h1 className="text-2xl font-heading text-zinc-900">Historial de Ventas</h1>
        <p className="text-zinc-500 text-sm mt-1">Consulta y gestiona las ventas realizadas</p>
      </div>

      {/* Filters */}
      <Card className="card-swiss">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="form-group">
              <Label className="form-label">Fecha Inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-swiss"
                data-testid="filter-start-date"
              />
            </div>
            <div className="form-group">
              <Label className="form-label">Fecha Fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-swiss"
                data-testid="filter-end-date"
              />
            </div>
            <div className="form-group">
              <Label className="form-label">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="input-swiss" data-testid="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="completada">Completadas</SelectItem>
                  <SelectItem value="anulada">Anuladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters} className="btn-primary flex-1" data-testid="apply-filters-button">
                <Filter className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
              <Button onClick={clearFilters} variant="outline" className="rounded-sm" data-testid="clear-filters-button">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-zinc-900">{summary?.total_ventas || sales.length}</p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Total Ventas</p>
              </div>
              <History className="h-8 w-8 text-zinc-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-emerald-600">
                  {summary?.ventas_completadas || sales.filter(s => s.estado !== 'anulada').length}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Completadas</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-rose-600">
                  {summary?.ventas_anuladas || sales.filter(s => s.estado === 'anulada').length}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Anuladas</p>
              </div>
              <XCircle className="h-8 w-8 text-rose-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-zinc-900">
                  {formatCurrency(summary?.monto_completadas || 0)}
                </p>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Total MXN</p>
              </div>
              <CheckCircle className="h-8 w-8 text-zinc-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card className="card-swiss">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Registro de Ventas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sales.length > 0 ? (
            <Table data-testid="sales-history-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Fecha</TableHead>
                  <TableHead className="table-header">Total</TableHead>
                  <TableHead className="table-header">Método</TableHead>
                  <TableHead className="table-header">Items</TableHead>
                  <TableHead className="table-header">Estado</TableHead>
                  <TableHead className="table-header text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow 
                    key={sale.id} 
                    className={sale.estado === 'anulada' ? 'bg-zinc-50 opacity-60' : ''}
                    data-testid={`sale-row-${sale.id}`}
                  >
                    <TableCell className="text-sm">
                      {formatDate(sale.fecha_venta)}
                    </TableCell>
                    <TableCell className={`font-medium ${sale.estado === 'anulada' ? 'line-through text-zinc-400' : ''}`}>
                      {formatCurrency(sale.monto_total)}
                    </TableCell>
                    <TableCell>
                      {getPaymentBadge(sale.metodo_pago)}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sale.estado)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedSale(sale); setShowDetails(true); }}
                          className="h-8 w-8 p-0"
                          data-testid={`sale-view-button-${sale.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {sale.estado !== 'anulada' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSaleToCancel(sale)}
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            data-testid={`sale-cancel-button-${sale.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state py-16" data-testid="no-sales-history">
              <History className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium text-zinc-600">No hay ventas registradas</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Detalle de Venta</DialogTitle>
            <DialogDescription>
              {selectedSale && formatDate(selectedSale.fecha_venta)}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4" data-testid="sale-details-modal">
              <div className="flex justify-between items-center">
                {getStatusBadge(selectedSale.estado)}
                {getPaymentBadge(selectedSale.metodo_pago)}
              </div>

              <div className="border rounded-sm divide-y">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium">{item.producto_nombre}</p>
                      <p className="text-zinc-500">
                        {formatCurrency(item.precio_unitario)} x {item.cantidad_vendida}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span className={selectedSale.estado === 'anulada' ? 'line-through text-zinc-400' : ''}>
                    {formatCurrency(selectedSale.monto_total)}
                  </span>
                </div>
                {selectedSale.cambio !== null && selectedSale.cambio !== undefined && (
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Cambio entregado:</span>
                    <span>{formatCurrency(selectedSale.cambio)}</span>
                  </div>
                )}
              </div>

              {selectedSale.estado === 'anulada' && (
                <div className="bg-rose-50 p-3 rounded-sm text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Esta venta fue anulada y el stock fue restaurado.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!saleToCancel} onOpenChange={(open) => !open && setSaleToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">¿Anular esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará la venta por <strong>{saleToCancel && formatCurrency(saleToCancel.monto_total)}</strong> y 
              restaurará el stock de los productos vendidos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSale}
              disabled={isCanceling}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              data-testid="confirm-cancel-sale-button"
            >
              {isCanceling ? 'Anulando...' : 'Sí, anular venta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
