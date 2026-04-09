import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import {
  LayoutDashboard, Package, ShoppingCart, History, BarChart3,
  LogOut, Menu, User, Users, Tag, PackagePlus, Wallet,
  Users2, ChevronDown, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navGroups = [
  {
    type: 'link',
    to: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    roles: ['admin'],
  },
  {
    type: 'group',
    icon: Package,
    label: 'Productos',
    roles: ['admin'],
    activePaths: ['/productos', '/categorias', '/entradas'],
    children: [
      { to: '/productos', icon: Package, label: 'Lista de productos' },
      { to: '/categorias', icon: Tag, label: 'Categorías' },
      { to: '/entradas', icon: PackagePlus, label: 'Entradas de stock' },
    ],
  },
  {
    type: 'link',
    to: '/ventas',
    icon: ShoppingCart,
    label: 'Ventas',
    roles: ['admin', 'vendedor'],
  },
  {
    type: 'link',
    to: '/historial',
    icon: History,
    label: 'Historial',
    roles: ['admin'],
  },
  {
    type: 'link',
    to: '/reportes',
    icon: BarChart3,
    label: 'Reportes',
    roles: ['admin'],
  },
  {
    type: 'link',
    to: '/corte',
    icon: Wallet,
    label: 'Corte de caja',
    roles: ['admin', 'vendedor'],
  },
  {
    type: 'link',
    to: '/clientes',
    icon: Users2,
    label: 'Clientes',
    roles: ['admin'],
  },
  {
    type: 'link',
    to: '/usuarios',
    icon: Users,
    label: 'Usuarios',
    roles: ['admin'],
  },
];

function NavGroup({ item, onNavigate }) {
  const location = useLocation();
  const isGroupActive = item.activePaths.some(p => location.pathname === p);
  const [open, setOpen] = useState(isGroupActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
          isGroupActive
            ? 'bg-zinc-100 text-zinc-900 font-medium'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
        }`}
      >
        <span className="flex items-center gap-3">
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
        }
      </button>

      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-zinc-200 space-y-0.5">
          {item.children.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white font-medium'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`
              }
            >
              <child.icon className="h-4 w-4 shrink-0" />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, onNavigate }) {
  if (item.type === 'group') {
    return <NavGroup item={item} onNavigate={onNavigate} />;
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-zinc-900 text-white font-medium'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
        }`
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  );
}

function getRoleBadge(role) {
  const styles = { admin: 'bg-zinc-900 text-white', vendedor: 'bg-emerald-600 text-white' };
  const labels = { admin: 'Admin', vendedor: 'Vendedor' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-sm ${styles[role] || 'bg-zinc-200'}`}>
      {labels[role] || role}
    </span>
  );
}

function SidebarContent({ filteredGroups, user, onLogout, onNavigate }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-200">
        <div className="p-2 bg-zinc-900 rounded-sm shrink-0">
          <Package className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-zinc-900 text-base">Inventario</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {filteredGroups.map(item => (
          <NavItem key={item.to || item.label} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Usuario + logout */}
      <div className="px-3 py-4 border-t border-zinc-200 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-md">
          <User className="h-4 w-4 text-zinc-400 shrink-0" />
          <p className="text-sm text-zinc-800 truncate flex-1 font-medium">{user?.name}</p>
          {getRoleBadge(user?.role)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border-zinc-200"
          data-testid="logout-button"
        >
          <LogOut className="h-4 w-4 mr-2 shrink-0" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredGroups = navGroups.filter(item =>
    item.roles.includes(user?.role || 'user')
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-zinc-200 shrink-0 sticky top-0 h-screen">
        <SidebarContent
          filteredGroups={filteredGroups}
          user={user}
          onLogout={handleLogout}
          onNavigate={undefined}
        />
      </aside>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex flex-col w-64 bg-white h-full shadow-xl">
            <SidebarContent
              filteredGroups={filteredGroups}
              user={user}
              onLogout={handleLogout}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar solo en móvil */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-zinc-200 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-zinc-900 rounded-sm">
              <Package className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900">Inventario</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-button"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
