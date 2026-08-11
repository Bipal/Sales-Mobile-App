const state = {
    latitude: null,
    longitude: null,
    locationName: null,
    locationReady: false
};

const salesForm = document.getElementById("salesForm");
const submitButton = document.getElementById("submitButton");
const locationStatus = document.getElementById("locationStatus");
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

function setLocationStatus(statusText) {
    locationStatus.textContent = statusText;
}

function updateLocationDisplay() {
    if (state.locationReady) {
        locationName.textContent =
            state.locationName || "Location detected";

        coordinates.textContent =
            `Latitude: ${state.latitude.toFixed(6)} | ` +
            `Longitude: ${state.longitude.toFixed(6)}`;

        setLocationStatus("Location ready");
    }
}

function handleLocationError(error) {
    console.error("Geolocation error:", error);

    state.locationReady = false;

    let message = "Unable to access device location.";

    if (error.code === 1) {
        message =
            "Location permission was denied. Please allow location access " +
            "and reload the app.";
    } else if (error.code === 2) {
        message =
            "Your location could not be determined. Please check GPS/location services.";
    } else if (error.code === 3) {
        message = "Location request timed out. Please try again.";
    }

    locationName.textContent = message;
    coordinates.textContent = "Latitude/Longitude: unavailable";
    setLocationStatus("Location unavailable");

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
        setLocationStatus("Not supported");
        showAlert(message, "danger");
        return;
    }

    setLocationStatus("Detecting...");
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

        // Keep the current device location for the next entry.
        updateLocationDisplay();

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

window.addEventListener("load", () => {
    getCurrentLocation();
});
