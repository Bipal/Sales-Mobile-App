import os
from datetime import datetime, timezone

import requests
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
CORS(app)

# Local development uses SQLite. Public deployment uses PostgreSQL
# when DATABASE_URL is configured.
database_url = os.getenv("DATABASE_URL", "sqlite:///sales.db")

# Some PostgreSQL providers still return postgres:// URLs.
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class SalesEntryV2(db.Model):
    __tablename__ = "sales_entries_v2"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_name = db.Column(db.String(150), nullable=False)
    country = db.Column(db.String(100), nullable=False)
    region = db.Column(db.String(100), nullable=False)
    product = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    sales = db.Column(db.Float, nullable=False)
    profit = db.Column(db.Float, nullable=False)
    discount = db.Column(db.Float, nullable=False)
    shipping_cost = db.Column(db.Float, nullable=False)

    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    location_name = db.Column(db.String(255), nullable=False)

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "customer_name": self.customer_name,
            "country": self.country,
            "region": self.region,
            "product": self.product,
            "category": self.category,
            "quantity": self.quantity,
            "sales": self.sales,
            "profit": self.profit,
            "discount": self.discount,
            "shipping_cost": self.shipping_cost,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "location_name": self.location_name,
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }


with app.app_context():
    db.create_all()


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/records")
def records():
    return render_template("records.html")

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "Sales Mobile POC"})


@app.route("/reverse-geocode", methods=["GET"])
def reverse_geocode():
    """Convert device coordinates into a readable location name."""
    try:
        latitude = float(request.args.get("lat", ""))
        longitude = float(request.args.get("lon", ""))

        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return jsonify({"error": "Invalid coordinates"}), 400

        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": latitude,
                "lon": longitude,
                "format": "jsonv2",
                "zoom": 18,
                "addressdetails": 1,
            },
            headers={
                "User-Agent": "Sales-Mobile-POC/1.0 interview-demo"
            },
            timeout=10,
        )
        response.raise_for_status()

        data = response.json()
        address = data.get("address", {})

        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("county")
            or ""
        )
        state = address.get("state", "")
        country = address.get("country", "")

        parts = [part for part in [city, state, country] if part]
        location_name = ", ".join(parts)

        if not location_name:
            location_name = data.get(
                "display_name",
                "Location detected"
            )

        return jsonify(
            {
                "location_name": location_name,
                "city": city,
                "state": state,
                "country": country,
                "latitude": latitude,
                "longitude": longitude,
            }
        )

    except ValueError:
        return jsonify(
            {"error": "Latitude and longitude must be numbers"}
        ), 400

    except requests.RequestException as exc:
        app.logger.warning("Reverse geocoding failed: %s", exc)
        return jsonify(
            {
                "error": "Could not determine the location name",
                "location_name": "Location detected",
            }
        ), 502


@app.route("/submit", methods=["POST"])
def submit():
    try:
        data = request.get_json(silent=True) or {}

        required_fields = [
            "customer_name",
            "country",
            "region",
            "product",
            "category",
            "quantity",
            "sales",
            "profit",
            "discount",
            "shipping_cost",
            "latitude",
            "longitude",
            "location_name",
        ]

        missing_fields = [
            field
            for field in required_fields
            if data.get(field) is None
            or str(data.get(field)).strip() == ""
        ]

        if missing_fields:
            return jsonify(
                {
                    "error": "Missing required fields",
                    "fields": missing_fields,
                }
            ), 400

        try:
            quantity = int(data["quantity"])
            sales = float(data["sales"])
            profit = float(data["profit"])
            discount = float(data["discount"])
            shipping_cost = float(data["shipping_cost"])
            latitude = float(data["latitude"])
            longitude = float(data["longitude"])
        except (TypeError, ValueError):
            return jsonify(
                {"error": "Numeric fields contain invalid values"}
            ), 400

        if quantity < 0:
            return jsonify(
                {"error": "Quantity cannot be negative"}
            ), 400

        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return jsonify({"error": "Invalid location coordinates"}), 400

        entry = SalesEntryV2(
            customer_name=str(data["customer_name"]).strip(),
            country=str(data["country"]).strip(),
            region=str(data["region"]).strip(),
            product=str(data["product"]).strip(),
            category=str(data["category"]).strip(),
            quantity=quantity,
            sales=sales,
            profit=profit,
            discount=discount,
            shipping_cost=shipping_cost,
            latitude=latitude,
            longitude=longitude,
            location_name=str(data["location_name"]).strip(),
        )

        db.session.add(entry)
        db.session.commit()

        return jsonify(
            {
                "message": "Sales data saved successfully!",
                "entry": entry.to_dict(),
            }
        ), 201

    except Exception:
        db.session.rollback()
        app.logger.exception("Failed to save sales entry")
        return jsonify(
            {"error": "Unable to save sales data"}
        ), 500


@app.route("/entries", methods=["GET"])
def entries():
    try:
        records = (
            SalesEntryV2.query
            .order_by(SalesEntryV2.created_at.desc())
            .all()
        )

        return jsonify(
            {
                "count": len(records),
                "entries": [record.to_dict() for record in records],
            }
        )

    except Exception:
        app.logger.exception("Failed to retrieve entries")
        return jsonify(
            {"error": "Unable to retrieve records"}
        ), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
