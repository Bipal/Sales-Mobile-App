const state = {
    latitude: null,
    longitude: null,
    locationName: null,
    locationReady: false
};

const charts = {
    salesTrend: null,
    profitTrend: null,
    category: null,
    product: null,
    country: null
};

let salesMap = null;
let dashboardLoaded = false;
let dashboardRefreshTimer = null;

const salesForm = document.getElementById("salesForm");
const submitButton = document.getElementById("submitButton");
const locationName = document.getElementById("locationName");
const coordinates = document.getElementById("coordinates");
const alertBox = document.getElementById("alertBox");

function showAlert(message, type = "danger") {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
}

function hideAlert() {
    alertBox.classList.add("d-none");
}

function updateLocationDisplay() {
    if (!state.locationReady) {
        return;
    }

    locationName.textContent =
        state.locationName || "Location detected";

    coordinates.textContent =
        `Latitude: ${state.latitude.toFixed(6)} | ` +
        `Longitude: ${state.longitude.toFixed(6)}`;
}

function handleLocationError(error) {
    console.error("Geolocation error:", error);

    state.locationReady = false;

    let message = "Unable to access device location.";

    if (error.code === 1) {
        message =
            "Location permission was denied. Please allow location access and reload the app.";
    } else if (error.code === 2) {
        message =
            "Your location could not be determined. Please check GPS/location services.";
    } else if (error.code === 3) {
        message =
            "Location request timed out. Please try again.";
    }

    locationName.textContent = message;
    coordinates.textContent = "Latitude/Longitude: unavailable";

    showAlert(message, "warning");
}

async function reverseGeocode(latitude, longitude) {
    try {
        const response = await fetch(
            `/reverse-geocode?lat=${encodeURIComponent(latitude)}` +
            `&lon=${encodeURIComponent(longitude)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Reverse geocoding failed"
            );
        }

        state.locationName =
            data.location_name || "Location detected";

    } catch (error) {
        console.error("Reverse geocoding error:", error);
        state.locationName = "Location detected";
    }

    state.locationReady = true;
    updateLocationDisplay();
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        const message =
            "Geolocation is not supported by this browser/device.";

        locationName.textContent = message;
        showAlert(message, "danger");
        return;
    }

    locationName.textContent = "Requesting device location...";
    coordinates.textContent = "Latitude/Longitude: detecting...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            state.latitude = position.coords.latitude;
            state.longitude = position.coords.longitude;

            coordinates.textContent =
                `Latitude: ${state.latitude.toFixed(6)} | ` +
                `Longitude: ${state.longitude.toFixed(6)}`;

            locationName.textContent = "Finding location name...";

            await reverseGeocode(
                state.latitude,
                state.longitude
            );
        },
        handleLocationError,
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
}

function getValue(id) {
    return document.getElementById(id).value.trim();
}

/* ============================================================
   SALES FORM
   ============================================================ */

salesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert();

    if (!salesForm.checkValidity()) {
        salesForm.classList.add("was-validated");

        showAlert(
            "Please complete all required fields.",
            "warning"
        );

        return;
    }

    if (!state.locationReady) {
        showAlert(
            "Location is not ready. Please allow location access and wait for the location to appear.",
            "warning"
        );

        return;
    }

    const payload = {
        customer_name: getValue("customer_name"),
        country: getValue("country"),
        region: getValue("region"),
        product: getValue("product"),
        category: getValue("category"),
        quantity: Number(getValue("quantity")),
        sales: Number(getValue("sales")),
        profit: Number(getValue("profit")),
        discount: Number(getValue("discount")),
        shipping_cost: Number(getValue("shipping_cost")),
        latitude: state.latitude,
        longitude: state.longitude,
        location_name: state.locationName
    };

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
        const response = await fetch("/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Failed to save sales data."
            );
        }

        showAlert(
            "Sales data saved successfully!",
            "success"
        );

        salesForm.reset();
        salesForm.classList.remove("was-validated");

        updateLocationDisplay();

        /*
         * If the dashboard is already loaded, immediately refresh it
         * so the newly submitted record appears in the visuals.
         */
        if (dashboardLoaded) {
            await loadDashboard();
        }

    } catch (error) {
        console.error("Submit error:", error);

        showAlert(
            error.message || "Unable to save sales data.",
            "danger"
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Sales Data";
    }
});

/* ============================================================
   PAGE NAVIGATION
   ============================================================ */

function setNavButton(activeButtonId) {
    const buttons = [
        "navEntry",
        "navRecords",
        "navDashboard"
    ];

    buttons.forEach((id) => {
        const button = document.getElementById(id);

        if (id === activeButtonId) {
            button.classList.remove("btn-outline-primary");
            button.classList.add("btn-primary");
        } else {
            button.classList.remove("btn-primary");
            button.classList.add("btn-outline-primary");
        }
    });
}

function showSection(section) {
    const sections = {
        entry: document.getElementById("entrySection"),
        records: document.getElementById("recordsSection"),
        dashboard: document.getElementById("dashboardSection")
    };

    Object.values(sections).forEach((element) => {
        element.classList.remove("active");
    });

    sections[section].classList.add("active");

    if (section === "entry") {
        setNavButton("navEntry");
    }

    if (section === "records") {
        setNavButton("navRecords");
        loadRecords();
    }

    if (section === "dashboard") {
        setNavButton("navDashboard");
        loadDashboard();
        startDashboardAutoRefresh();
    } else {
        stopDashboardAutoRefresh();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* ============================================================
   VIEW RECORDS
   ============================================================ */

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function formatNumber(value, decimals = 2) {
    return Number(value || 0).toLocaleString(
        undefined,
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString(
        undefined,
        {
            maximumFractionDigits: 2
        }
    );
}

async function loadRecords() {
    const recordsBody = document.getElementById("recordsBody");
    const recordCount = document.getElementById("recordCount");

    recordsBody.innerHTML = `
        <tr>
            <td colspan="11" class="text-center text-muted py-4">
                Loading records...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/entries");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to load records."
            );
        }

        recordCount.textContent =
            `${data.count} record${data.count === 1 ? "" : "s"}`;

        if (!data.entries || data.entries.length === 0) {
            recordsBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center text-muted py-4">
                        No sales records found.
                    </td>
                </tr>
            `;

            return;
        }

        recordsBody.innerHTML = data.entries.map((entry) => `
            <tr>
                <td>${entry.id}</td>
                <td>${formatDate(entry.created_at)}</td>
                <td>${escapeHtml(entry.customer_name)}</td>
                <td>${escapeHtml(entry.country)}</td>
                <td>${escapeHtml(entry.region)}</td>
                <td>${escapeHtml(entry.product)}</td>
                <td>${escapeHtml(entry.category)}</td>
                <td>${formatNumber(entry.quantity, 0)}</td>
                <td>${formatCurrency(entry.sales)}</td>
                <td>${formatCurrency(entry.profit)}</td>
                <td>${escapeHtml(entry.location_name)}</td>
            </tr>
        `).join("");

    } catch (error) {
        console.error("Records error:", error);

        recordCount.textContent = "Unable to load records";

        recordsBody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-danger py-4">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function destroyChart(chartName) {
    if (charts[chartName]) {
        charts[chartName].destroy();
        charts[chartName] = null;
    }
}

function makeChartColors(count) {
    const colors = [
        "#0d6efd",
        "#198754",
        "#ffc107",
        "#dc3545",
        "#6f42c1",
        "#20c997",
        "#fd7e14",
        "#0dcaf0",
        "#6c757d",
        "#6610f2"
    ];

    return Array.from(
        { length: count },
        (_, index) => colors[index % colors.length]
    );
}

function renderDashboardCharts(data) {
    const trends = data.monthly_trend || [];
    const categories = data.sales_by_category || [];
    const products = data.profit_by_product || [];
    const countries = data.sales_by_country || [];

    /* Sales trend */
    destroyChart("salesTrend");

    charts.salesTrend = new Chart(
        document.getElementById("salesTrendChart"),
        {
            type: "line",
            data: {
                labels: trends.map(item => item.label),
                datasets: [
                    {
                        label: "Sales",
                        data: trends.map(item => item.sales),
                        borderColor: "#0d6efd",
                        backgroundColor: "rgba(13, 110, 253, 0.15)",
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );

    /* Profit trend */
    destroyChart("profitTrend");

    charts.profitTrend = new Chart(
        document.getElementById("profitTrendChart"),
        {
            type: "line",
            data: {
                labels: trends.map(item => item.label),
                datasets: [
                    {
                        label: "Profit",
                        data: trends.map(item => item.profit),
                        borderColor: "#198754",
                        backgroundColor: "rgba(25, 135, 84, 0.15)",
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );

    /* Category */
    destroyChart("category");

    charts.category = new Chart(
        document.getElementById("categoryChart"),
        {
            type: "bar",
            data: {
                labels: categories.map(item => item.category),
                datasets: [
                    {
                        label: "Sales",
                        data: categories.map(item => item.sales),
                        backgroundColor: makeChartColors(categories.length)
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );

    /* Products */
    destroyChart("product");

    charts.product = new Chart(
        document.getElementById("productChart"),
        {
            type: "bar",
            data: {
                labels: products.map(item => item.product),
                datasets: [
                    {
                        label: "Profit",
                        data: products.map(item => item.profit),
                        backgroundColor: "#0d6efd"
                    }
                ]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        }
    );

    /* Country */
    destroyChart("country");

    charts.country = new Chart(
        document.getElementById("countryChart"),
        {
            type: "doughnut",
            data: {
                labels: countries.map(item => item.country),
                datasets: [
                    {
                        label: "Sales",
                        data: countries.map(item => item.sales),
                        backgroundColor: makeChartColors(countries.length)
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );
}

function renderSalesMap(entries) {
    if (!salesMap) {
        salesMap = L.map("salesMap").setView(
            [20.5937, 78.9629],
            4
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap contributors"
            }
        ).addTo(salesMap);
    }

    salesMap.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            salesMap.removeLayer(layer);
        }
    });

    const validEntries = (entries || []).filter(
        entry =>
            Number.isFinite(Number(entry.latitude)) &&
            Number.isFinite(Number(entry.longitude))
    );

    validEntries.forEach((entry) => {
        const marker = L.marker([
            Number(entry.latitude),
            Number(entry.longitude)
        ]).addTo(salesMap);

        marker.bindPopup(`
            <strong>${escapeHtml(entry.customer_name)}</strong><br>
            ${escapeHtml(entry.product)}<br>
            Sales: ${formatCurrency(entry.sales)}<br>
            Profit: ${formatCurrency(entry.profit)}<br>
            ${escapeHtml(entry.location_name)}
        `);
    });

    if (validEntries.length > 0) {
        const bounds = L.latLngBounds(
            validEntries.map(entry => [
                Number(entry.latitude),
                Number(entry.longitude)
            ])
        );

        salesMap.fitBounds(bounds, {
            padding: [30, 30],
            maxZoom: 12
        });
    }

    setTimeout(() => {
        salesMap.invalidateSize();
    }, 100);
}

async function loadDashboard() {
    try {
        const response = await fetch("/dashboard-data");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to load dashboard."
            );
        }

        const summary = data.summary || {};

        document.getElementById("kpiSales").textContent =
            formatCurrency(summary.total_sales);

        document.getElementById("kpiProfit").textContent =
            formatCurrency(summary.total_profit);

        document.getElementById("kpiMargin").textContent =
            `${Number(summary.profit_margin || 0).toFixed(2)}%`;

        document.getElementById("kpiOrders").textContent =
            formatNumber(summary.total_orders, 0);

        renderDashboardCharts(data);
        renderSalesMap(data.entries);

        document.getElementById("dashboardUpdated").textContent =
            `Updated ${new Date().toLocaleTimeString()} • ` +
            `${summary.total_orders || 0} records`;

        dashboardLoaded = true;

    } catch (error) {
        console.error("Dashboard error:", error);

        document.getElementById("dashboardUpdated").textContent =
            error.message;

        showAlert(
            "Dashboard could not be loaded: " + error.message,
            "warning"
        );
    }
}

function startDashboardAutoRefresh() {
    stopDashboardAutoRefresh();

    dashboardRefreshTimer = setInterval(
        () => loadDashboard(),
        30000
    );
}

function stopDashboardAutoRefresh() {
    if (dashboardRefreshTimer) {
        clearInterval(dashboardRefreshTimer);
        dashboardRefreshTimer = null;
    }
}

/* ============================================================
   STARTUP
   ============================================================ */

window.addEventListener("load", () => {
    getCurrentLocation();
});
