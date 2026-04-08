#!/usr/bin/env python3
"""
Backend API Testing for Sistema de Inventario MVP
Tests all endpoints with proper authentication and data validation
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class InventoryAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_credentials = {
            "email": "admin@inventario.com",
            "password": "admin123"
        }
        self.created_product_id = None
        self.created_sale_id = None

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
            
            if not success:
                print(f"   Status: {response.status_code}, Expected: {expected_status}")
                print(f"   Response: {response_data}")
            
            return success, response_data

        except Exception as e:
            print(f"   Request failed: {str(e)}")
            return False, {"error": str(e)}

    def test_root_endpoint(self) -> bool:
        """Test API root endpoint"""
        success, data = self.make_request('GET', '/')
        return self.log_test("API Root Endpoint", success, f"- {data.get('message', '')}")

    def test_admin_login(self) -> bool:
        """Test admin login with correct credentials"""
        success, data = self.make_request('POST', '/auth/login', self.admin_credentials)
        
        if success:
            # Verify response structure
            required_fields = ['id', 'email', 'name', 'role']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                success = False
                details = f"- Missing fields: {missing_fields}"
            else:
                details = f"- Role: {data.get('role')}, Email: {data.get('email')}"
        else:
            details = f"- {data.get('detail', 'Unknown error')}"
        
        return self.log_test("Admin Login", success, details)

    def test_invalid_login(self) -> bool:
        """Test login with invalid credentials"""
        invalid_creds = {"email": "wrong@test.com", "password": "wrongpass"}
        success, data = self.make_request('POST', '/auth/login', invalid_creds, expected_status=401)
        return self.log_test("Invalid Login (401)", success, f"- {data.get('detail', '')}")

    def test_auth_me(self) -> bool:
        """Test getting current user info"""
        success, data = self.make_request('GET', '/auth/me')
        
        if success:
            details = f"- User: {data.get('name')}, Role: {data.get('role')}"
        else:
            details = f"- {data.get('detail', 'Auth required')}"
        
        return self.log_test("Get Current User", success, details)

    def test_create_product(self) -> bool:
        """Test creating a new product"""
        product_data = {
            "nombre": f"Producto Test {datetime.now().strftime('%H%M%S')}",
            "precio_unitario": 25.50,
            "unidad_medida": "piezas",
            "cantidad_stock": 100.0,
            "cantidad_minima": 10.0
        }
        
        success, data = self.make_request('POST', '/products', product_data, expected_status=200)
        
        if success:
            self.created_product_id = data.get('id')
            stock_status = data.get('stock_status')
            details = f"- ID: {self.created_product_id}, Status: {stock_status}"
        else:
            details = f"- {data.get('detail', 'Creation failed')}"
        
        return self.log_test("Create Product", success, details)

    def test_list_products(self) -> bool:
        """Test listing all products"""
        success, data = self.make_request('GET', '/products')
        
        if success:
            product_count = len(data) if isinstance(data, list) else 0
            details = f"- Found {product_count} products"
            
            # Verify stock status calculation
            if product_count > 0:
                sample_product = data[0]
                required_fields = ['id', 'nombre', 'precio_unitario', 'stock_status']
                missing_fields = [field for field in required_fields if field not in sample_product]
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
        else:
            details = f"- {data.get('detail', 'Failed to fetch')}"
        
        return self.log_test("List Products", success, details)

    def test_get_product(self) -> bool:
        """Test getting a specific product"""
        if not self.created_product_id:
            return self.log_test("Get Product", False, "- No product ID available")
        
        success, data = self.make_request('GET', f'/products/{self.created_product_id}')
        
        if success:
            details = f"- Name: {data.get('nombre')}, Stock: {data.get('cantidad_stock')}"
        else:
            details = f"- {data.get('detail', 'Not found')}"
        
        return self.log_test("Get Product", success, details)

    def test_update_product(self) -> bool:
        """Test updating a product"""
        if not self.created_product_id:
            return self.log_test("Update Product", False, "- No product ID available")
        
        update_data = {
            "cantidad_stock": 5.0,  # This should make it red status (below minimum)
            "precio_unitario": 30.00
        }
        
        success, data = self.make_request('PUT', f'/products/{self.created_product_id}', update_data)
        
        if success:
            new_status = data.get('stock_status')
            new_price = data.get('precio_unitario')
            details = f"- Status: {new_status}, Price: ${new_price}"
            
            # Verify stock status changed to red (stock=5, min=10)
            if new_status != 'red':
                success = False
                details += f" (Expected red status for low stock)"
        else:
            details = f"- {data.get('detail', 'Update failed')}"
        
        return self.log_test("Update Product", success, details)

    def test_dashboard_summary(self) -> bool:
        """Test dashboard summary endpoint"""
        success, data = self.make_request('GET', '/dashboard/summary')
        
        if success:
            required_fields = ['productos_total', 'stock_verde', 'stock_amarillo', 'stock_rojo', 
                             'ventas_hoy', 'cantidad_ventas_hoy']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                success = False
                details = f"- Missing fields: {missing_fields}"
            else:
                details = f"- Products: {data.get('productos_total')}, Red stock: {data.get('stock_rojo')}"
        else:
            details = f"- {data.get('detail', 'Failed to fetch')}"
        
        return self.log_test("Dashboard Summary", success, details)

    def test_create_sale(self) -> bool:
        """Test creating a sale"""
        if not self.created_product_id:
            return self.log_test("Create Sale", False, "- No product ID available")
        
        sale_data = {
            "items": [
                {
                    "producto_id": self.created_product_id,
                    "cantidad": 2.0
                }
            ],
            "metodo_pago": "efectivo",
            "monto_recibido": 100.00
        }
        
        success, data = self.make_request('POST', '/sales', sale_data, expected_status=200)
        
        if success:
            self.created_sale_id = data.get('id')
            total = data.get('monto_total')
            change = data.get('cambio')
            details = f"- ID: {self.created_sale_id}, Total: ${total}, Change: ${change}"
        else:
            details = f"- {data.get('detail', 'Sale failed')}"
        
        return self.log_test("Create Sale", success, details)

    def test_list_sales(self) -> bool:
        """Test listing sales"""
        success, data = self.make_request('GET', '/sales')
        
        if success:
            sales_count = len(data) if isinstance(data, list) else 0
            details = f"- Found {sales_count} sales"
        else:
            details = f"- {data.get('detail', 'Failed to fetch')}"
        
        return self.log_test("List Sales", success, details)

    def test_today_sales_summary(self) -> bool:
        """Test today's sales summary"""
        success, data = self.make_request('GET', '/sales/today-summary')
        
        if success:
            total_sales = data.get('total_ventas', 0)
            count_sales = data.get('cantidad_ventas', 0)
            details = f"- Total: ${total_sales}, Count: {count_sales}"
        else:
            details = f"- {data.get('detail', 'Failed to fetch')}"
        
        return self.log_test("Today Sales Summary", success, details)

    def test_insufficient_stock_sale(self) -> bool:
        """Test sale with insufficient stock"""
        if not self.created_product_id:
            return self.log_test("Insufficient Stock Sale", False, "- No product ID available")
        
        # Try to sell more than available stock (current stock should be 3 after previous sale)
        sale_data = {
            "items": [
                {
                    "producto_id": self.created_product_id,
                    "cantidad": 10.0  # More than available
                }
            ],
            "metodo_pago": "efectivo",
            "monto_recibido": 500.00
        }
        
        success, data = self.make_request('POST', '/sales', sale_data, expected_status=400)
        
        if success:
            details = f"- Correctly rejected: {data.get('detail', '')}"
        else:
            details = f"- Should have been rejected with 400"
        
        return self.log_test("Insufficient Stock Sale (400)", success, details)

    def test_cash_payment_insufficient(self) -> bool:
        """Test cash payment with insufficient amount"""
        if not self.created_product_id:
            return self.log_test("Insufficient Cash Payment", False, "- No product ID available")
        
        sale_data = {
            "items": [
                {
                    "producto_id": self.created_product_id,
                    "cantidad": 1.0
                }
            ],
            "metodo_pago": "efectivo",
            "monto_recibido": 10.00  # Less than product price (30.00)
        }
        
        success, data = self.make_request('POST', '/sales', sale_data, expected_status=400)
        
        if success:
            details = f"- Correctly rejected: {data.get('detail', '')}"
        else:
            details = f"- Should have been rejected with 400"
        
        return self.log_test("Insufficient Cash Payment (400)", success, details)

    def test_cancel_sale(self) -> bool:
        """Test sale cancellation and stock restoration"""
        if not self.created_sale_id:
            return self.log_test("Cancel Sale", False, "- No sale ID available")
        
        # Get initial product stock before cancellation
        success, initial_product = self.make_request('GET', f'/products/{self.created_product_id}')
        if not success:
            return self.log_test("Cancel Sale - Get Initial Stock", False, "- Could not get product stock")
        
        initial_stock = initial_product.get('cantidad_stock', 0)
        
        # Cancel the sale
        success, data = self.make_request('POST', f'/sales/{self.created_sale_id}/cancel')
        
        if success:
            # Verify stock was restored
            stock_success, updated_product = self.make_request('GET', f'/products/{self.created_product_id}')
            if stock_success:
                new_stock = updated_product.get('cantidad_stock', 0)
                expected_stock = initial_stock + 2.0  # We sold 2 units earlier
                stock_restored = new_stock == expected_stock
                
                # Verify sale status changed
                sales_success, sales_data = self.make_request('GET', '/sales')
                sale_status_updated = False
                if sales_success:
                    for sale in sales_data:
                        if sale.get('id') == self.created_sale_id:
                            sale_status_updated = sale.get('estado') == 'anulada'
                            break
                
                if stock_restored and sale_status_updated:
                    details = f"- Stock restored: {new_stock}, Status: anulada"
                else:
                    details = f"- Stock restored: {stock_restored}, Status updated: {sale_status_updated}"
                
                return self.log_test("Cancel Sale", stock_restored and sale_status_updated, details)
            else:
                return self.log_test("Cancel Sale - Verify Stock", False, "- Could not verify stock restoration")
        else:
            details = f"- {data.get('detail', 'Cancellation failed')}"
            return self.log_test("Cancel Sale", success, details)

    def test_double_cancel_prevention(self) -> bool:
        """Test that already cancelled sales cannot be cancelled again"""
        if not self.created_sale_id:
            return self.log_test("Double Cancel Prevention", False, "- No sale ID available")
        
        # Try to cancel the already cancelled sale
        success, data = self.make_request('POST', f'/sales/{self.created_sale_id}/cancel', expected_status=400)
        
        if success:
            details = f"- Correctly prevented: {data.get('detail', '')}"
        else:
            details = f"- Should have been rejected with 400"
        
        return self.log_test("Double Cancel Prevention (400)", success, details)

    def test_logout(self) -> bool:
        """Test logout functionality"""
        success, data = self.make_request('POST', '/auth/logout')
        
        if success:
            details = f"- {data.get('message', 'Logged out')}"
        else:
            details = f"- {data.get('detail', 'Logout failed')}"
        
        return self.log_test("Logout", success, details)

    def test_unauthorized_access(self) -> bool:
        """Test accessing protected endpoint after logout"""
        success, data = self.make_request('GET', '/auth/me', expected_status=401)
        
        if success:
            details = f"- Correctly rejected: {data.get('detail', '')}"
        else:
            details = f"- Should have been rejected with 401"
        
        return self.log_test("Unauthorized Access (401)", success, details)

    def test_reports_sales(self) -> bool:
        """Test sales report endpoint with filters"""
        # Re-login for reports testing
        login_success, _ = self.make_request('POST', '/auth/login', self.admin_credentials)
        if not login_success:
            return self.log_test("Reports Sales - Login", False, "- Could not login for reports")
        
        # Test without filters
        success, data = self.make_request('GET', '/reports/sales')
        
        if success:
            required_fields = ['sales', 'summary']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                success = False
                details = f"- Missing fields: {missing_fields}"
            else:
                sales_count = len(data.get('sales', []))
                summary = data.get('summary', {})
                details = f"- Sales: {sales_count}, Total: {summary.get('total_ventas', 0)}"
        else:
            details = f"- {data.get('detail', 'Failed to fetch')}"
        
        return self.log_test("Reports Sales", success, details)

    def test_reports_sales_with_filters(self) -> bool:
        """Test sales report with date and status filters"""
        from datetime import date
        today = date.today().strftime('%Y-%m-%d')
        
        # Test with date filter
        success, data = self.make_request('GET', f'/reports/sales?start_date={today}&status=completada')
        
        if success:
            sales = data.get('sales', [])
            summary = data.get('summary', {})
            details = f"- Filtered sales: {len(sales)}, Completadas: {summary.get('ventas_completadas', 0)}"
        else:
            details = f"- {data.get('detail', 'Failed to fetch with filters')}"
        
        return self.log_test("Reports Sales with Filters", success, details)

    def test_reports_statistics(self) -> bool:
        """Test statistics endpoint for charts"""
        # Test with default 7 days
        success, data = self.make_request('GET', '/reports/statistics?days=7')
        
        if success:
            required_fields = ['daily_sales', 'payment_breakdown', 'top_products', 'period']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                success = False
                details = f"- Missing fields: {missing_fields}"
            else:
                daily_count = len(data.get('daily_sales', []))
                payment_count = len(data.get('payment_breakdown', []))
                top_products_count = len(data.get('top_products', []))
                details = f"- Daily: {daily_count}, Payments: {payment_count}, Top products: {top_products_count}"
        else:
            details = f"- {data.get('detail', 'Failed to fetch statistics')}"
        
        return self.log_test("Reports Statistics", success, details)

    def test_reports_statistics_different_periods(self) -> bool:
        """Test statistics with different time periods"""
        periods = [14, 30, 90]
        all_success = True
        details_list = []
        
        for days in periods:
            success, data = self.make_request('GET', f'/reports/statistics?days={days}')
            if success:
                period_info = data.get('period', {})
                actual_days = period_info.get('days', 0)
                details_list.append(f"{days}d: {actual_days}")
                if actual_days != days:
                    all_success = False
            else:
                all_success = False
                details_list.append(f"{days}d: FAILED")
        
        details = f"- Periods tested: {', '.join(details_list)}"
        return self.log_test("Reports Statistics Different Periods", all_success, details)

    def test_export_csv(self) -> bool:
        """Test CSV export functionality"""
        # Make request with blob response type simulation
        url = f"{self.base_url}/api/reports/sales/export/csv"
        headers = {'Content-Type': 'application/json'}
        
        try:
            response = self.session.get(url, headers=headers)
            success = response.status_code == 200
            
            if success:
                # Check if response is CSV-like
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                is_csv = 'text/csv' in content_type or 'attachment' in content_disposition
                details = f"- Content-Type: {content_type}, Size: {len(response.content)} bytes"
                
                if not is_csv:
                    success = False
                    details += " (Not CSV format)"
            else:
                details = f"- Status: {response.status_code}"
            
        except Exception as e:
            success = False
            details = f"- Error: {str(e)}"
        
        return self.log_test("Export CSV", success, details)

    def test_export_pdf(self) -> bool:
        """Test PDF export functionality"""
        url = f"{self.base_url}/api/reports/sales/export/pdf"
        headers = {'Content-Type': 'application/json'}
        
        try:
            response = self.session.get(url, headers=headers)
            success = response.status_code == 200
            
            if success:
                # Check if response is PDF-like
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                is_pdf = 'application/pdf' in content_type or 'attachment' in content_disposition
                details = f"- Content-Type: {content_type}, Size: {len(response.content)} bytes"
                
                if not is_pdf:
                    success = False
                    details += " (Not PDF format)"
            else:
                details = f"- Status: {response.status_code}"
            
        except Exception as e:
            success = False
            details = f"- Error: {str(e)}"
        
        return self.log_test("Export PDF", success, details)

    def test_export_with_filters(self) -> bool:
        """Test export with date and status filters"""
        from datetime import date
        today = date.today().strftime('%Y-%m-%d')
        
        # Test CSV export with filters
        url = f"{self.base_url}/api/reports/sales/export/csv?start_date={today}&status=completada"
        
        try:
            response = self.session.get(url)
            success = response.status_code == 200
            
            if success:
                details = f"- CSV with filters: {len(response.content)} bytes"
            else:
                details = f"- Status: {response.status_code}"
            
        except Exception as e:
            success = False
            details = f"- Error: {str(e)}"
        
        return self.log_test("Export with Filters", success, details)

    def cleanup_test_data(self) -> bool:
        """Clean up test data (requires re-login)"""
        # Re-login for cleanup
        login_success, _ = self.make_request('POST', '/auth/login', self.admin_credentials)
        if not login_success:
            return self.log_test("Cleanup Login", False, "- Could not re-login for cleanup")
        
        success = True
        if self.created_product_id:
            delete_success, data = self.make_request('DELETE', f'/products/{self.created_product_id}')
            if delete_success:
                details = "- Test product deleted"
            else:
                success = False
                details = f"- Failed to delete product: {data.get('detail', '')}"
        else:
            details = "- No test product to delete"
        
        return self.log_test("Cleanup Test Data", success, details)

    def run_all_tests(self) -> int:
        """Run all tests in sequence"""
        print("🧪 Starting Backend API Tests for Sistema de Inventario MVP")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        test_methods = [
            self.test_root_endpoint,
            self.test_admin_login,
            self.test_invalid_login,
            self.test_auth_me,
            self.test_create_product,
            self.test_list_products,
            self.test_get_product,
            self.test_update_product,
            self.test_dashboard_summary,
            self.test_create_sale,
            self.test_list_sales,
            self.test_today_sales_summary,
            self.test_cancel_sale,
            self.test_double_cancel_prevention,
            self.test_insufficient_stock_sale,
            self.test_cash_payment_insufficient,
            # New reports endpoints tests
            self.test_reports_sales,
            self.test_reports_sales_with_filters,
            self.test_reports_statistics,
            self.test_reports_statistics_different_periods,
            self.test_export_csv,
            self.test_export_pdf,
            self.test_export_with_filters,
            self.test_logout,
            self.test_unauthorized_access,
            self.cleanup_test_data
        ]
        
        for test_method in test_methods:
            test_method()
            print()  # Add spacing between tests
        
        # Final results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            failed_count = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_count} test(s) failed")
            return 1

def main():
    """Main test runner"""
    tester = InventoryAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())