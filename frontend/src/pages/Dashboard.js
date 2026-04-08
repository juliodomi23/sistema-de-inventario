import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Package, ShoppingCart, AlertTriangle, CheckCircle, XCircle, DollarSign } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/summary`, {
        withCredentials: true
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
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
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-container">
      <div>
        <h1 className="text-2xl font-heading text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Resumen del inventario y ventas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-swiss" data-testid="dashboard-total-products-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-value">{summary?.productos_total || 0}</p>
                <p className="metric-label">Productos</p>
              </div>
              <div className="p-2 bg-zinc-100 rounded-sm">
                <Package className="h-5 w-5 text-zinc-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss" data-testid="dashboard-today-sales-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-value" data-testid="dashboard-total-sales-metric">
                  {formatCurrency(summary?.ventas_hoy || 0)}
                </p>
                <p className="metric-label">Ventas Hoy</p>
              </div>
              <div className="p-2 bg-zinc-100 rounded-sm">
                <DollarSign className="h-5 w-5 text-zinc-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss" data-testid="dashboard-sales-count-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-value">{summary?.cantidad_ventas_hoy || 0}</p>
                <p className="metric-label">Transacciones Hoy</p>
              </div>
              <div className="p-2 bg-zinc-100 rounded-sm">
                <ShoppingCart className="h-5 w-5 text-zinc-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-swiss" data-testid="dashboard-low-stock-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-value text-rose-600">{summary?.stock_rojo || 0}</p>
                <p className="metric-label">Stock Bajo</p>
              </div>
              <div className="p-2 bg-rose-100 rounded-sm">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Status and Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Status */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Estado del Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-sm" data-testid="stock-status-green">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">Stock Óptimo</span>
                </div>
                <span className="text-xl font-semibold text-emerald-700">{summary?.stock_verde || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-sm" data-testid="stock-status-yellow">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Stock Medio</span>
                </div>
                <span className="text-xl font-semibold text-amber-700">{summary?.stock_amarillo || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-sm" data-testid="stock-status-red">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-rose-600" />
                  <span className="text-sm font-medium text-rose-800">Stock Crítico</span>
                </div>
                <span className="text-xl font-semibold text-rose-700">{summary?.stock_rojo || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="card-swiss">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Últimas Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.ultimas_ventas && summary.ultimas_ventas.length > 0 ? (
              <div className="space-y-3" data-testid="recent-sales-list">
                {summary.ultimas_ventas.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 border border-zinc-100 rounded-sm">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{formatCurrency(sale.total)}</p>
                      <p className="text-xs text-zinc-500">{formatDate(sale.fecha)}</p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-1 rounded-sm">
                      {sale.metodo_pago}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" data-testid="no-recent-sales">
                <ShoppingCart className="h-8 w-8 mb-2" />
                <p className="text-sm">No hay ventas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
