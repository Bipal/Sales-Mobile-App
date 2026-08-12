import os
from datetime import datetime, timezone

import requests

from flask import (
    Flask,
    jsonify,
    render_template,
    request
)

from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy


# ============================================================
# APPLICATION
# ============================================================

app = Flask(__name__)

CORS(app)


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

# Local development:
#     SQLite -> sales.db
#
# Render deployment:
#     PostgreSQL -> DATABASE_URL

database_url = os.getenv(
    "DATABASE_URL",
    "sqlite:///sales.db"
)


# Some PostgreSQL providers may return
# postgres:// instead of postgresql://

if database_url.startswith("postgres://"):

    database_url = database_url.replace(
        "postgres://",
        "postgresql://",
        1
    )


app.config[
    "SQLALCHEMY_DATABASE_URI"
] = database_url

app.config[
    "SQLALCHEMY_TRACK_MODIFICATIONS"
] = False


db = SQLAlchemy(app)


# ============================================================
# POWER BI CONFIGURATION
# ============================================================

# We will add the actual Power BI public embed URL
# later through Render Environment Variables.
#
# Example:
#
# POWERBI_EMBED_URL=https://app.powerbi.com/view?r=XXXXXXXX

POWERBI_EMBED_URL = os.getenv(
    "POWERBI_EMBED_URL",
    ""
)


# ============================================================
# DATABASE MODEL
# ============================================================

class SalesEntryV2(db.Model):

    __tablename__ = "sales_entries_v2"


    id = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )


    customer_name = db.Column(
        db.String(150),
        nullable=False
    )


    country = db.Column(
        db.String(100),
        nullable=False
    )


    region = db.Column(
        db.String(100),
        nullable=False
    )


    product = db.Column(
        db.String(100),
        nullable=False
    )


    category = db.Column(
        db.String(100),
        nullable=False
    )


    quantity = db.Column(
        db.Integer,
        nullable=False
    )


    sales = db.Column(
        db.Float,
        nullable=False
    )


    profit = db.Column(
        db.Float,
        nullable=False
    )


    discount = db.Column(
        db.Float,
        nullable=False
    )


    shipping_cost = db.Column(
        db.Float,
        nullable=False
    )


    latitude = db.Column(
        db.Float,
        nullable=False
    )


    longitude = db.Column(
        db.Float,
        nullable=False
    )


    location_name = db.Column(
        db.String(255),
        nullable=False
    )


    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )


    # ========================================================
    # CONVERT DATABASE RECORD TO JSON
    # ========================================================

    def to_dict(self):

        return {

            "id":
                self.id,

            "customer_name":
                self.customer_name,

            "country":
                self.country,

            "region":
                self.region,

            "product":
                self.product,

            "category":
                self.category,

            "quantity":
                self.quantity,

            "sales":
                self.sales,

            "profit":
                self.profit,

            "discount":
                self.discount,

            "shipping_cost":
                self.shipping_cost,

            "latitude":
                self.latitude,

            "longitude":
                self.longitude,

            "location_name":
                self.location_name,

            "created_at":
                (
                    self.created_at.isoformat()
                    if self.created_at
                    else None
                )

        }


# ============================================================
# CREATE TABLES
# ============================================================

with app.app_context():

    db.create_all()


# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def home():

    return render_template(
        "index.html"
    )


# ============================================================
# VIEW RECORDS PAGE
# ============================================================

@app.route("/records")
def records_page():

    return render_template(
        "records.html"
    )


# ============================================================
# POWER BI DASHBOARD PAGE
# ============================================================

@app.route("/dashboard")
def dashboard():

    return render_template(
        "dashboard.html",
        powerbi_url=POWERBI_EMBED_URL
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():

    return jsonify(
        {
            "status": "ok",
            "service": "Sales Mobile POC"
        }
    )


# ============================================================
# REVERSE GEOCODING
# ============================================================

@app.route(
    "/reverse-geocode",
    methods=["GET"]
)
def reverse_geocode():

    try:

        latitude = float(
            request.args.get(
                "lat",
                ""
            )
        )

        longitude = float(
            request.args.get(
                "lon",
                ""
            )
        )


        # Validate coordinates

        if not (
            -90 <= latitude <= 90
            and
            -180 <= longitude <= 180
        ):

            return jsonify(
                {
                    "error":
                        "Invalid coordinates"
                }
            ), 400


        # OpenStreetMap Nominatim

        response = requests.get(

            "https://nominatim.openstreetmap.org/reverse",

            params={

                "lat":
                    latitude,

                "lon":
                    longitude,

                "format":
                    "jsonv2",

                "zoom":
                    18,

                "addressdetails":
                    1

            },

            headers={

                "User-Agent":
                    "Sales-Mobile-POC/1.0 interview-demo"

            },

            timeout=10

        )


        response.raise_for_status()


        data = response.json()

        address = data.get(
            "address",
            {}
        )


        city = (

            address.get("city")

            or address.get("town")

            or address.get("village")

            or address.get("municipality")

            or address.get("county")

            or ""

        )


        state = address.get(
            "state",
            ""
        )


        country = address.get(
            "country",
            ""
        )


        parts = [

            part

            for part in [
                city,
                state,
                country
            ]

            if part

        ]


        location_name = ", ".join(
            parts
        )


        if not location_name:

            location_name = data.get(
                "display_name",
                "Location detected"
            )


        return jsonify(
            {

                "location_name":
                    location_name,

                "city":
                    city,

                "state":
                    state,

                "country":
                    country,

                "latitude":
                    latitude,

                "longitude":
                    longitude

            }
        )


    except ValueError:

        return jsonify(
            {
                "error":
                    "Latitude and longitude must be numbers"
            }
        ), 400


    except requests.RequestException as exc:

        app.logger.warning(
            "Reverse geocoding failed: %s",
            exc
        )


        return jsonify(
            {

                "error":
                    "Could not determine the location name",

                "location_name":
                    "Location detected"

            }
        ), 502


# ============================================================
# SUBMIT SALES DATA
# ============================================================

@app.route(
    "/submit",
    methods=["POST"]
)
def submit():

    try:

        data = request.get_json(
            silent=True
        ) or {}


        # ----------------------------------------------------
        # REQUIRED FIELDS
        # ----------------------------------------------------

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

            "location_name"

        ]


        missing_fields = [

            field

            for field in required_fields

            if data.get(field) is None
            or str(
                data.get(field)
            ).strip() == ""

        ]


        if missing_fields:

            return jsonify(
                {

                    "error":
                        "Missing required fields",

                    "fields":
                        missing_fields

                }
            ), 400


        # ----------------------------------------------------
        # CONVERT NUMERIC FIELDS
        # ----------------------------------------------------

        try:

            quantity = int(
                data["quantity"]
            )

            sales = float(
                data["sales"]
            )

            profit = float(
                data["profit"]
            )

            discount = float(
                data["discount"]
            )

            shipping_cost = float(
                data["shipping_cost"]
            )

            latitude = float(
                data["latitude"]
            )

            longitude = float(
                data["longitude"]
            )


        except (
            TypeError,
            ValueError
        ):

            return jsonify(
                {
                    "error":
                        "Numeric fields contain invalid values"
                }
            ), 400


        # ----------------------------------------------------
        # VALIDATE QUANTITY
        # ----------------------------------------------------

        if quantity < 0:

            return jsonify(
                {
                    "error":
                        "Quantity cannot be negative"
                }
            ), 400


        # ----------------------------------------------------
        # VALIDATE LOCATION
        # ----------------------------------------------------

        if not (
            -90 <= latitude <= 90
            and
            -180 <= longitude <= 180
        ):

            return jsonify(
                {
                    "error":
                        "Invalid location coordinates"
                }
            ), 400


        # ----------------------------------------------------
        # CREATE DATABASE RECORD
        # ----------------------------------------------------

        entry = SalesEntryV2(

            customer_name=
                str(
                    data["customer_name"]
                ).strip(),

            country=
                str(
                    data["country"]
                ).strip(),

            region=
                str(
                    data["region"]
                ).strip(),

            product=
                str(
                    data["product"]
                ).strip(),

            category=
                str(
                    data["category"]
                ).strip(),

            quantity=
                quantity,

            sales=
                sales,

            profit=
                profit,

            discount=
                discount,

            shipping_cost=
                shipping_cost,

            latitude=
                latitude,

            longitude=
                longitude,

            location_name=
                str(
                    data["location_name"]
                ).strip()

        )


        db.session.add(
            entry
        )

        db.session.commit()


        # ----------------------------------------------------
        # SUCCESS RESPONSE
        # ----------------------------------------------------

        return jsonify(
            {

                "message":
                    "Sales data saved successfully!",

                "entry":
                    entry.to_dict()

            }
        ), 201


    except Exception:

        db.session.rollback()

        app.logger.exception(
            "Failed to save sales entry"
        )


        return jsonify(
            {
                "error":
                    "Unable to save sales data"
            }
        ), 500


# ============================================================
# GET SALES RECORDS - API
# ============================================================

@app.route(
    "/entries",
    methods=["GET"]
)
def entries():

    try:

        records = (

            SalesEntryV2.query

            .order_by(
                SalesEntryV2.created_at.desc()
            )

            .all()

        )


        return jsonify(
            {

                "count":
                    len(records),

                "entries":
                    [
                        record.to_dict()
                        for record in records
                    ]

            }
        )


    except Exception:

        app.logger.exception(
            "Failed to retrieve entries"
        )


        return jsonify(
            {
                "error":
                    "Unable to retrieve records"
            }
        ), 500


# ============================================================
# START APPLICATION
# ============================================================

if __name__ == "__main__":

    port = int(
        os.getenv(
            "PORT",
            "5000"
        )
    )


    app.run(

        host="0.0.0.0",

        port=port,

        debug=True

    )