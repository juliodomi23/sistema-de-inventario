#!/usr/bin/env python3
"""
Vendedor Role Testing for Sistema de Inventario MVP
Tests vendedor-specific functionality and access restrictions
"""

import requests
import sys
import json
from datetime import datetime

class VendedorAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.vendedor_credentials = {
            "email": "vendedor@inventario.com",
            "password": "vendedor123"
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def make_request(self, method: str, endpoint: str, data=None, expected_status: int = 200):
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
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

    def test_vendedor_login(self) -> bool:
        """Test vendedor login"""
        success, data = self.make_request('POST', '/auth/login', self.vendedor_credentials)
        
        if success:
            # Verify role is vendedor
            if data.get('role') == 'vendedor':
                details = f"- Role: {data.get('role')}, Email: {data.get('email')}"
            else:
                success = False
                details = f"- Expected role 'vendedor', got '{data.get('role')}'"
        else:
            details = f"- {data.get('detail', 'Unknown error')}"
        
        return self.log_test("Vendedor Login", success, details)

    def test_vendedor_auth_me(self) -> bool:
        """Test getting vendedor user info"""
        success, data = self.make_request('GET', '/auth/me')
        
        if success:
            if data.get('role') == 'vendedor':
                details = f"- User: {data.get('name')}, Role: {data.get('role')}"
            else:
                success = False
                details = f"- Expected role 'vendedor', got '{data.get('role')}'"
        else:
            details = f"- {data.get('detail', 'Auth required')}"
        
        return self.log_test("Vendedor Get Current User", success, details)

    def test_vendedor_can_access_products(self) -> bool:
        """Test that vendedor can access products (for sales)"""
        success, data = self.make_request('GET', '/products')
        
        if success:
            product_count = len(data) if isinstance(data, list) else 0
            details = f"- Can access products: {product_count} found"
        else:
            details = f"- {data.get('detail', 'Access denied')}"
        
        return self.log_test("Vendedor Access Products", success, details)

    def test_vendedor_can_access_sales(self) -> bool:
        """Test that vendedor can access sales endpoints"""
        success, data = self.make_request('GET', '/sales')
        
        if success:
            sales_count = len(data) if isinstance(data, list) else 0
            details = f"- Can access sales: {sales_count} found"
        else:
            details = f"- {data.get('detail', 'Access denied')}"
        
        return self.log_test("Vendedor Access Sales", success, details)

    def test_vendedor_can_create_sale(self) -> bool:
        """Test that vendedor can create sales"""
        # First get a product to sell
        success, products = self.make_request('GET', '/products')
        if not success or not products:
            return self.log_test("Vendedor Create Sale", False, "- No products available")
        
        product = products[0]
        if product.get('cantidad_stock', 0) <= 0:
            return self.log_test("Vendedor Create Sale", False, "- No stock available")
        
        sale_data = {
            "items": [
                {
                    "producto_id": product['id'],
                    "cantidad": 1.0
                }
            ],
            "metodo_pago": "efectivo",
            "monto_recibido": 100.00
        }
        
        success, data = self.make_request('POST', '/sales', sale_data)
        
        if success:
            total = data.get('monto_total')
            details = f"- Sale created: ID {data.get('id')}, Total: ${total}"
        else:
            details = f"- {data.get('detail', 'Sale creation failed')}"
        
        return self.log_test("Vendedor Create Sale", success, details)

    def test_vendedor_dashboard_access(self) -> bool:
        """Test that vendedor can access dashboard summary (for sales info)"""
        success, data = self.make_request('GET', '/dashboard/summary')
        
        if success:
            details = f"- Can access dashboard summary"
        else:
            details = f"- {data.get('detail', 'Access denied')}"
        
        return self.log_test("Vendedor Dashboard Access", success, details)

    def run_all_tests(self) -> int:
        """Run all vendedor tests"""
        print("🧪 Starting Vendedor Role Tests for Sistema de Inventario MVP")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        test_methods = [
            self.test_vendedor_login,
            self.test_vendedor_auth_me,
            self.test_vendedor_can_access_products,
            self.test_vendedor_can_access_sales,
            self.test_vendedor_can_create_sale,
            self.test_vendedor_dashboard_access,
        ]
        
        for test_method in test_methods:
            test_method()
            print()
        
        # Final results
        print("=" * 60)
        print(f"📊 Vendedor Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All vendedor tests passed!")
            return 0
        else:
            failed_count = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_count} vendedor test(s) failed")
            return 1

def main():
    """Main test runner"""
    tester = VendedorAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())