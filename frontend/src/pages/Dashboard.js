import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Package, ShoppingCart, AlertTriangle, CheckCircle,
  XCircle, DollarSign, TrendingUp, TrendingDown, Warehouse, Info
} from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

const formatDate = (dateString) =>
  new Date(dateString).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });

function KpiCard({ label, value, icon: Icon, iconBg, iconColor, badge, note }) {
  return (
    <Card data-testid={`kpi-${label}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-2xl font-bold text-zinc-900 truncate">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5 uppercase tracking-wide">{label}</p>
            {note && (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />{note}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className={`p-2 rounded-md ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            {badge}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeBadge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    }`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{pct}% vs ayer
    </span>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/summary')
      .then(r => setSummary(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  const s = summary || {};

  return (
    <div className="space-y-6" data-testid="dashboard-container">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Resumen del día</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Productos"
          value={s.productos_total ?? 0}
          icon={Package}
          iconBg="bg-zinc-100"
          iconColor="text-zinc-600"
        />
        <KpiCard
          label="Ventas hoy"
          value={formatCurrency(s.ventas_hoy ?? 0)}
          icon={DollarSign}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          badge={<ChangeBadge pct={s.cambio_vs_ayer} />}
        />
        <KpiCard
          label="Transacciones"
          value={s.cantidad_ventas_hoy ?? 0}
          icon={ShoppingCart}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <KpiCard
          label="Ganancia hoy"
          value={s.ganancia_tiene_datos ? formatCurrency(s.ganancia_hoy ?? 0) : '—'}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          note={!s.ganancia_tiene_datos ? 'Agrega costos a tus productos' : undefined}
        />
        <KpiCard
          label="Valor inventario"
          value={formatCurrency(s.valor_inventario ?? 0)}
          icon={Warehouse}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KpiCard
          label="Stock bajo"
          value={s.stock_rojo ?? 0}
          icon={AlertTriangle}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* Stock status + Recent sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Estado del inventario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">Stock óptimo</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{s.stock_verde ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Stock medio</span>
              </div>
              <span className="text-lg font-bold text-amber-700">{s.stock_amarillo ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-600" />
                <span className="text-sm font-medium text-rose-800">Stock crítico</span>
              </div>
              <span className="text-lg font-bold text-rose-700">{s.stock_rojo ?? 0}</span>
            </div>

            {/* Mini summary bar */}
            {(s.productos_total ?? 0) > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <div className="flex rounded-full overflow-hidden h-2">
                  <div
                    className="bg-emerald-400"
                    style={{ width: `${((s.stock_verde ?? 0) / s.productos_total) * 100}%` }}
                  />
                  <div
                    className="bg-amber-400"
                    style={{ width: `${((s.stock_amarillo ?? 0) / s.productos_total) * 100}%` }}
                  />
                  <div
                    className="bg-rose-400"
                    style={{ width: `${((s.stock_rojo ?? 0) / s.productos_total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-1 text-right">{s.productos_total} productos en total</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Últimas ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {s.ultimas_ventas?.length > 0 ? (
              <div className="space-y-2" data-testid="recent-sales-list">
                {s.ultimas_ventas.map(sale => (
                  <div
                    key={sale.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      sale.estado === 'anulada' ? 'border-rose-100 bg-rose-50' : 'border-zinc-100 bg-zinc-50'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${sale.estado === 'anulada' ? 'text-rose-600 line-through' : 'text-zinc-900'}`}>
                        {formatCurrency(sale.total)}
                      </p>
                      <p className="text-xs text-zinc-400">{formatDate(sale.fecha)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full capitalize">
                        {sale.metodo_pago}
                      </span>
                      {sale.estado === 'anulada' && (
                        <span className="text-xs text-rose-500">Anulada</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
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
