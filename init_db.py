import os
import psycopg2


DATABASE_URL = os.environ.get("DATABASE_URL")


conn = psycopg2.connect(
    DATABASE_URL
)


cursor = conn.cursor()


cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS sales_entries
    (

        id SERIAL PRIMARY KEY,

        customer_name VARCHAR(200),

        country VARCHAR(100),

        region VARCHAR(100),

        product VARCHAR(200),

        category VARCHAR(100),

        quantity INTEGER,

        sales NUMERIC(15,2),

        profit NUMERIC(15,2),

        discount NUMERIC(10,2),

        shipping_cost NUMERIC(15,2),

        latitude DOUBLE PRECISION,

        longitude DOUBLE PRECISION,

        location_name VARCHAR(300),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    )
    """
)


conn.commit()


cursor.close()

conn.close()


print(
    "Database initialized successfully."
)