import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, Package, ShoppingCart, History, BarChart3, LogOut, Menu, X, User } from 'lucide-react';
import { useState } from 'react';

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin'] },
  { to: '/productos', icon: Package, label: 'Productos', roles: ['admin'] },
  { to: '/ventas', icon: ShoppingCart, label: 'Ventas', roles: ['admin', 'vendedor'] },
  { to: '/historial', icon: History, label: 'Historial', roles: ['admin'] },
  { to: '/reportes', icon: BarChart3, label: 'Reportes', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Filter nav items based on user role
  const navItems = allNavItems.filter(item => 
    item.roles.includes(user?.role || 'user')
  );

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-zinc-900 text-white',
      vendedor: 'bg-emerald-600 text-white'
    };
    const labels = {
      admin: 'Admin',
      vendedor: 'Vendedor'
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-sm ${styles[role] || 'bg-zinc-200'}`}>
        {labels[role] || role}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-900 rounded-sm">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading text-lg text-zinc-900 hidden sm:block">Inventario</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1" data-testid="main-navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive ? 'nav-link-active' : 'nav-link'
                  }
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4 inline mr-2" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-sm">
                <User className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-600" data-testid="user-name">
                  {user?.name}
                </span>
                {getRoleBadge(user?.role)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border-zinc-200"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-button"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-zinc-200 bg-white" data-testid="mobile-navigation">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-sm ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900 font-medium'
                        : 'text-zinc-600 hover:bg-zinc-50'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 inline mr-2" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
