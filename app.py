import os
import requests
import psycopg2

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


# ==========================================================
# DATABASE CONNECTION
# ==========================================================

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_connection():

    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable not configured.")

    return psycopg2.connect(DATABASE_URL)


# ==========================================================
# HOME PAGE
# ==========================================================

@app.route("/")
def home():

    return render_template("index.html")


# ==========================================================
# HEALTH CHECK
# ==========================================================

@app.route("/health")
def health():

    return jsonify({
        "status": "ok"
    })


# ==========================================================
# CREATE SALES ENTRY
# ==========================================================

@app.route("/submit", methods=["POST"])
def submit():

    data = request.get_json()

    if not data:

        return jsonify({
            "message": "No data received."
        }), 400


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
        if field not in data
    ]


    if missing_fields:

        return jsonify({
            "message": "Missing fields",
            "fields": missing_fields
        }), 400


    try:

        conn = get_connection()

        cursor = conn.cursor()


        cursor.execute(
            """
            INSERT INTO sales_entries
            (
                customer_name,
                country,
                region,
                product,
                category,
                quantity,
                sales,
                profit,
                discount,
                shipping_cost,
                latitude,
                longitude,
                location_name
            )

            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )

            RETURNING id
            """,

            (
                data["customer_name"],
                data["country"],
                data["region"],
                data["product"],
                data["category"],
                int(data["quantity"]),
                float(data["sales"]),
                float(data["profit"]),
                float(data["discount"]),
                float(data["shipping_cost"]),
                float(data["latitude"]),
                float(data["longitude"]),
                data["location_name"]
            )
        )


        new_id = cursor.fetchone()[0]


        conn.commit()

        cursor.close()

        conn.close()


        return jsonify({

            "message": "Sales data saved successfully.",

            "id": new_id

        }), 201


    except Exception as error:

        print(error)

        return jsonify({

            "message": "Database error.",
            "error": str(error)

        }), 500


# ==========================================================
# GET SALES RECORDS
# ==========================================================

@app.route("/entries")
def entries():

    try:

        conn = get_connection()

        cursor = conn.cursor()


        cursor.execute(
            """
            SELECT

                id,
                customer_name,
                country,
                region,
                product,
                category,
                quantity,
                sales,
                profit,
                discount,
                shipping_cost,
                latitude,
                longitude,
                location_name,
                created_at

            FROM sales_entries

            ORDER BY id DESC

            LIMIT 100
            """
        )


        rows = cursor.fetchall()


        records = []


        for row in rows:

            records.append({

                "id": row[0],
                "customer_name": row[1],
                "country": row[2],
                "region": row[3],
                "product": row[4],
                "category": row[5],
                "quantity": row[6],
                "sales": float(row[7]),
                "profit": float(row[8]),
                "discount": float(row[9]),
                "shipping_cost": float(row[10]),
                "latitude": float(row[11]),
                "longitude": float(row[12]),
                "location_name": row[13],
                "created_at": str(row[14])
            })


        cursor.close()

        conn.close()


        return jsonify(records)


    except Exception as error:

        print(error)

        return jsonify({

            "message": "Unable to retrieve records."

        }), 500


# ==========================================================
# REVERSE GEOCODING
# ==========================================================

@app.route("/reverse-geocode")
def reverse_geocode():

    latitude = request.args.get("lat")

    longitude = request.args.get("lon")


    if not latitude or not longitude:

        return jsonify({

            "message": "Latitude and longitude required."

        }), 400


    try:

        response = requests.get(

            "https://nominatim.openstreetmap.org/reverse",

            params={

                "format": "jsonv2",

                "lat": latitude,

                "lon": longitude,

                "addressdetails": 1

            },

            headers={

                "User-Agent":
                "SalesManagementPOC/1.0"

            },

            timeout=10
        )


        response.raise_for_status()


        result = response.json()


        address = result.get(
            "address",
            {}
        )


        city = (

            address.get("city")

            or address.get("town")

            or address.get("village")

            or address.get("municipality")

            or address.get("suburb")

            or ""

        )


        state = (

            address.get("state")

            or address.get("region")

            or ""

        )


        country = address.get(
            "country",
            ""
        )


        parts = [

            city,
            state,
            country

        ]


        parts = [

            value
            for value in parts
            if value

        ]


        location_name = ", ".join(parts)


        if not location_name:

            location_name = "Location detected"


        return jsonify({

            "location_name":
            location_name,

            "city":
            city,

            "state":
            state,

            "country":
            country

        })


    except Exception as error:

        print(error)

        return jsonify({

            "message":
            "Unable to determine location."

        }), 500


# ==========================================================
# START APPLICATION
# ==========================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(
            os.environ.get(
                "PORT",
                5000
            )
        )
    )