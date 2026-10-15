"""Backend tests for A Sua Drogaria.

Covers: config, products listing/search/detail, orders (create, stock, 409, code),
admin login, admin orders, admin product CRUD, webhook, import (CSV/XLSX)."""
import io
import os
import time

import openpyxl
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ["EXPO_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASS = "drogaria2026"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/admin/login", json={"password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


# ---------- Public ----------
class TestConfigAndProducts:
    def test_config(self, session):
        r = session.get(f"{API}/config")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] and d["phone"] and d["pix_key"]

    def test_list_products(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 20
        p = items[0]
        for k in ("id", "name", "price", "stock", "category"):
            assert k in p
        assert "_id" not in p

    def test_filter_by_category(self, session):
        r = session.get(f"{API}/products", params={"category": "medicamentos"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(p["category"] == "medicamentos" for p in items)

    def test_search(self, session):
        r = session.get(f"{API}/products", params={"search": "Dipirona"})
        assert r.status_code == 200
        assert any("Dipirona" in p["name"] for p in r.json())

    def test_product_detail(self, session):
        p = session.get(f"{API}/products").json()[0]
        r = session.get(f"{API}/products/{p['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == p["id"]

    def test_product_detail_invalid(self, session):
        r = session.get(f"{API}/products/invalid_id_123")
        assert r.status_code == 404


# ---------- Orders ----------
class TestOrders:
    def test_create_order_and_sequential_code(self, session):
        products = session.get(f"{API}/products").json()
        p = next(x for x in products if x["stock"] >= 2)
        payload = {
            "customer_name": "TEST Cliente",
            "customer_phone": "21999887766",
            "address": "Rua Teste 123",
            "neighborhood": "Centro",
            "complement": "",
            "payment_method": "pix",
            "items": [{"product_id": p["id"], "qty": 1}],
        }
        r = session.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        order1 = r.json()
        assert order1["code"].isdigit()
        assert int(order1["code"]) >= 1001
        assert order1["status"] == "pendente"
        assert order1["total"] > 0

        # second order → sequential
        r2 = session.post(f"{API}/orders", json=payload)
        assert r2.status_code == 200
        assert int(r2.json()["code"]) == int(order1["code"]) + 1

        # fetch by code with masked phone
        r3 = session.get(f"{API}/orders/{order1['code']}")
        assert r3.status_code == 200
        fetched = r3.json()
        assert "*" in fetched["customer_phone"] or fetched["customer_phone"] != "21999887766"

    def test_order_insufficient_stock(self, session):
        products = session.get(f"{API}/products").json()
        p = products[0]
        payload = {
            "customer_name": "TEST Overflow",
            "customer_phone": "21999887700",
            "address": "Rua X 999",
            "neighborhood": "Bairro",
            "payment_method": "dinheiro",
            "items": [{"product_id": p["id"], "qty": 99}],
        }
        r = session.post(f"{API}/orders", json=payload)
        assert r.status_code == 409

    def test_order_invalid_payment(self, session):
        products = session.get(f"{API}/products").json()
        payload = {
            "customer_name": "TEST Fail",
            "customer_phone": "21999887755",
            "address": "Rua X 1",
            "neighborhood": "Bairro",
            "payment_method": "bitcoin",
            "items": [{"product_id": products[0]["id"], "qty": 1}],
        }
        r = session.post(f"{API}/orders", json=payload)
        assert r.status_code == 400

    def test_order_validation(self, session):
        r = session.post(f"{API}/orders", json={"customer_name": "x"})
        assert r.status_code == 422


# ---------- Admin auth ----------
class TestAdminAuth:
    def test_login_wrong(self, session):
        r = session.post(f"{API}/admin/login", json={"password": "errada"})
        assert r.status_code == 401

    def test_login_ok(self, session):
        r = session.post(f"{API}/admin/login", json={"password": ADMIN_PASS})
        assert r.status_code == 200 and r.json().get("token")

    def test_admin_route_without_token(self, session):
        r = requests.get(f"{API}/admin/orders")
        assert r.status_code == 401

    def test_admin_route_bad_token(self):
        r = requests.get(f"{API}/admin/orders", headers={"Authorization": "Bearer xxx"})
        assert r.status_code == 401


# ---------- Admin orders ----------
class TestAdminOrders:
    def test_list_and_advance_status(self, session, admin_headers):
        # ensure an order exists
        products = session.get(f"{API}/products").json()
        p = next(x for x in products if x["stock"] >= 1)
        session.post(f"{API}/orders", json={
            "customer_name": "TEST Admin", "customer_phone": "21988112233",
            "address": "Rua Admin 1", "neighborhood": "AdminBairro",
            "payment_method": "cartao",
            "items": [{"product_id": p["id"], "qty": 1}],
        })
        r = requests.get(f"{API}/admin/orders", headers=admin_headers)
        assert r.status_code == 200
        orders = r.json()
        assert len(orders) > 0
        o = orders[0]
        r2 = requests.patch(f"{API}/admin/orders/{o['id']}/status",
                            headers=admin_headers, json={"status": "em_separacao"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "em_separacao"

    def test_invalid_status(self, admin_headers):
        orders = requests.get(f"{API}/admin/orders", headers=admin_headers).json()
        r = requests.patch(f"{API}/admin/orders/{orders[0]['id']}/status",
                           headers=admin_headers, json={"status": "foo"})
        assert r.status_code == 400


# ---------- Admin products CRUD ----------
class TestAdminProducts:
    def test_crud_flow(self, admin_headers):
        # create
        payload = {"name": "TEST_Produto", "price": 10.0, "promo_price": 8.5,
                   "stock": 5, "category": "medicamentos", "barcode": "TEST_BC_001"}
        r = requests.post(f"{API}/admin/products", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["promo_price"] == 8.5

        # update + remove promo
        r = requests.put(f"{API}/admin/products/{pid}", headers=admin_headers,
                         json={"price": 12.0, "promo_price": None})
        assert r.status_code == 200
        assert r.json()["price"] == 12.0
        assert r.json()["promo_price"] is None

        # soft delete
        r = requests.delete(f"{API}/admin/products/{pid}", headers=admin_headers)
        assert r.status_code == 200
        # public GET should 404 (inactive)
        r = requests.get(f"{API}/products/{pid}")
        assert r.status_code == 404


# ---------- Webhook / import ----------
class TestWebhookAndImport:
    def test_webhook_array_pt(self):
        r = requests.post(f"{API}/webhook/products", json=[
            {"id": "TR-SEED-1", "codigo_barras": "7891058001231", "preco": 11.11, "estoque": 50}
        ])
        assert r.status_code == 200
        assert r.json()["updated"] + r.json()["created"] == 1

    def test_webhook_object_wrapper_en(self):
        r = requests.post(f"{API}/webhook/products", json={
            "products": [{"barcode": "TEST_WH_002", "name": "TEST_Webhook_New",
                          "price": 5.5, "stock": 7, "category": "higiene"}]
        })
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["created"] + d["updated"] == 1

    def test_webhook_bad_payload(self):
        r = requests.post(f"{API}/webhook/products", json="notalist")
        assert r.status_code == 400

    def test_import_csv_semicolon(self, admin_token):
        csv_data = b"codigo_barras;nome;preco;estoque;categoria\n"
        csv_data += b"TEST_CSV_1;TEST_CSV_Prod1;15,90;10;medicamentos\n"
        csv_data += b"TEST_CSV_2;TEST_CSV_Prod2;7,50;5;higiene\n"
        files = {"file": ("test.csv", csv_data, "text/csv")}
        r = requests.post(f"{API}/admin/import", files=files,
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] and d["total_rows"] == 2
        assert d["created"] + d["updated"] == 2

    def test_import_csv_comma(self, admin_token):
        csv_data = b"codigo_barras,nome,preco,estoque\n"
        csv_data += b"TEST_CSV_3,TEST_CSV_Prod3,9.99,3\n"
        files = {"file": ("test.csv", csv_data, "text/csv")}
        r = requests.post(f"{API}/admin/import", files=files,
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.json()["total_rows"] == 1

    def test_import_xlsx(self, admin_token):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["codigo_barras", "nome", "preco", "estoque", "categoria"])
        ws.append(["TEST_XLSX_1", "TEST_XLSX_Prod1", 22.50, 8, "cosmeticos"])
        ws.append(["TEST_XLSX_2", "TEST_XLSX_Prod2", 33.00, 2, "suplementos"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        files = {"file": ("stock.xlsx", buf.read(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/admin/import", files=files,
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] and d["total_rows"] == 2

    def test_import_update_by_barcode(self, admin_token):
        # Second import with same barcode should update, not create
        csv_data = b"codigo_barras;preco;estoque\nTEST_CSV_1;19,90;99\n"
        files = {"file": ("upd.csv", csv_data, "text/csv")}
        r = requests.post(f"{API}/admin/import", files=files,
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.json()["updated"] >= 1


# ---------- File serving ----------
class TestFiles:
    def test_file_not_found(self):
        r = requests.get(f"{API}/files/nonexistent/path.jpg")
        assert r.status_code == 404
