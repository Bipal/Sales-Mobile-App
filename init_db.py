from app import app, db

with app.app_context():
    db.create_all()
    print("Database initialized successfully.")
    print("Table ready: sales_entries_v2")
