const state = {
    latitude: null,
    longitude: null,
    locationName: null,
    locationReady: false
};


// ---------------------------------------------------------
// TEST LOCATION MODE
// ---------------------------------------------------------
// Test mode is enabled ONLY when the URL contains:
//
// http://127.0.0.1:5000/?test_location=1
//
// This allows testing on a corporate laptop where browser
// GPS permission is blocked.
//
// Normal users/mobile devices will use real GPS.
// ---------------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);

const TEST_LOCATION_MODE =
    urlParams.get("test_location") === "1";

const TEST_LOCATION = {
    latitude: 12.9716,
    longitude: 77.5946,
    locationName: "Bengaluru, Karnataka, India"
};


// ---------------------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------------------

const salesForm =
    document.getElementById("salesForm");

const submitButton =
    document.getElementById("submitButton");

// The top-right Location Status was removed from the UI.
// This variable is kept as null-safe logic so the existing
// location functions continue to work without errors.
const locationStatus =
    document.getElementById("locationStatus");

const locationName =
    document.getElementById("locationName");

const coordinates =
    document.getElementById("coordinates");

const alertBox =
    document.getElementById("alertBox");


// ---------------------------------------------------------
// ALERT FUNCTIONS
// ---------------------------------------------------------

function showAlert(message, type = "danger") {

    alertBox.className =
        `alert alert-${type}`;

    alertBox.textContent =
        message;

    alertBox.classList.remove("d-none");
}


function hideAlert() {

    alertBox.classList.add("d-none");
}


// ---------------------------------------------------------
// LOCATION STATUS
// ---------------------------------------------------------
// The top-right "Device Location / Location ready"
// display has been removed from the frontend.
//
// We keep this function because other parts of the
// application still call setLocationStatus().
// It intentionally does nothing now.
// ---------------------------------------------------------

function setLocationStatus(statusText) {

    // Location status is no longer displayed
    // in the header.

    if (locationStatus) {
        locationStatus.textContent =
            statusText;
    }
}


// ---------------------------------------------------------
// UPDATE LOCATION DISPLAY
// ---------------------------------------------------------

function updateLocationDisplay() {

    if (!state.locationReady) {
        return;
    }

    locationName.textContent =
        state.locationName ||
        "Location detected";

    coordinates.textContent =
        `Latitude: ${state.latitude.toFixed(6)} | ` +
        `Longitude: ${state.longitude.toFixed(6)}`;

    // Keep the function call for compatibility,
    // but the status is no longer visible.
    setLocationStatus(
        TEST_LOCATION_MODE
            ? "TEST LOCATION"
            : "Location ready"
    );
}


// ---------------------------------------------------------
// TEST LOCATION
// ---------------------------------------------------------

function useTestLocation() {

    console.log(
        "TEST LOCATION MODE ENABLED"
    );

    state.latitude =
        TEST_LOCATION.latitude;

    state.longitude =
        TEST_LOCATION.longitude;

    state.locationName =
        TEST_LOCATION.locationName;

    state.locationReady =
        true;


    locationName.textContent =
        TEST_LOCATION.locationName;

    coordinates.textContent =
        `Latitude: ${TEST_LOCATION.latitude.toFixed(6)} | ` +
        `Longitude: ${TEST_LOCATION.longitude.toFixed(6)}`;


    // No visible header status anymore.
    setLocationStatus(
        "TEST LOCATION"
    );


    showAlert(
        "Test location enabled: Bengaluru, Karnataka, India",
        "info"
    );


    updateLocationDisplay();
}


// ---------------------------------------------------------
// HANDLE REAL LOCATION ERROR
// ---------------------------------------------------------

function handleLocationError(error) {

    console.error(
        "Geolocation error:",
        error
    );

    state.locationReady =
        false;


    let message =
        "Unable to access device location.";


    if (error.code === 1) {

        message =
            "Location permission was denied. " +
            "Please allow location access and reload the app.";

    } else if (error.code === 2) {

        message =
            "Your location could not be determined. " +
            "Please check GPS/location services.";

    } else if (error.code === 3) {

        message =
            "Location request timed out. " +
            "Please try again.";
    }


    locationName.textContent =
        message;

    coordinates.textContent =
        "Latitude/Longitude: unavailable";


    // No visible header status anymore.
    setLocationStatus(
        "Location unavailable"
    );


    showAlert(
        message,
        "warning"
    );
}


// ---------------------------------------------------------
// REVERSE GEOCODING
// ---------------------------------------------------------

async function reverseGeocode(
    latitude,
    longitude
) {

    try {

        const response =
            await fetch(
                `/reverse-geocode?lat=${encodeURIComponent(latitude)}` +
                `&lon=${encodeURIComponent(longitude)}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Reverse geocoding failed"
            );
        }


        state.locationName =
            data.location_name ||
            "Location detected";


    } catch (error) {

        console.error(
            "Reverse geocoding error:",
            error
        );


        state.locationName =
            "Location detected";
    }


    state.locationReady =
        true;


    updateLocationDisplay();
}


// ---------------------------------------------------------
// GET REAL DEVICE LOCATION
// ---------------------------------------------------------

function getCurrentLocation() {

    // If TEST LOCATION MODE is enabled,
    // do not request browser GPS.
    if (TEST_LOCATION_MODE) {

        useTestLocation();

        return;
    }


    // Check browser support.
    if (!navigator.geolocation) {

        const message =
            "Geolocation is not supported by this browser/device.";


        locationName.textContent =
            message;


        setLocationStatus(
            "Not supported"
        );


        showAlert(
            message,
            "danger"
        );


        return;
    }


    // No visible status message in the header.
    setLocationStatus(
        "Detecting..."
    );


    locationName.textContent =
        "Requesting device location...";


    coordinates.textContent =
        "Latitude/Longitude: detecting...";


    navigator.geolocation.getCurrentPosition(

        async (position) => {

            state.latitude =
                position.coords.latitude;

            state.longitude =
                position.coords.longitude;


            coordinates.textContent =
                `Latitude: ${state.latitude.toFixed(6)} | ` +
                `Longitude: ${state.longitude.toFixed(6)}`;


            locationName.textContent =
                "Finding location name...";


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


// ---------------------------------------------------------
// GET FORM VALUE
// ---------------------------------------------------------

function getValue(id) {

    return document
        .getElementById(id)
        .value
        .trim();
}


// ---------------------------------------------------------
// FORM SUBMISSION
// ---------------------------------------------------------

salesForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        hideAlert();


        // Validate normal form fields.
        if (!salesForm.checkValidity()) {

            salesForm.classList.add(
                "was-validated"
            );


            showAlert(
                "Please complete all required fields.",
                "warning"
            );


            return;
        }


        // Location must be available.
        if (!state.locationReady) {

            showAlert(
                "Location is not ready. " +
                "Please allow location access " +
                "and wait for the location to appear.",
                "warning"
            );


            return;
        }


        // -------------------------------------------------
        // BUILD PAYLOAD
        // -------------------------------------------------

        const payload = {

            customer_name:
                getValue("customer_name"),

            country:
                getValue("country"),

            region:
                getValue("region"),

            product:
                getValue("product"),

            category:
                getValue("category"),

            quantity:
                Number(
                    getValue("quantity")
                ),

            sales:
                Number(
                    getValue("sales")
                ),

            profit:
                Number(
                    getValue("profit")
                ),

            discount:
                Number(
                    getValue("discount")
                ),

            shipping_cost:
                Number(
                    getValue("shipping_cost")
                ),

            latitude:
                state.latitude,

            longitude:
                state.longitude,

            location_name:
                state.locationName
        };


        console.log(
            "Submitting sales data:",
            payload
        );


        // -------------------------------------------------
        // SUBMIT
        // -------------------------------------------------

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Saving...";


        try {

            const response =
                await fetch(
                    "/submit",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload)
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Failed to save sales data."
                );
            }


            // -------------------------------------------------
            // SUCCESS
            // -------------------------------------------------

            showAlert(
                TEST_LOCATION_MODE
                    ? "Sales data saved successfully using TEST LOCATION."
                    : "Sales data saved successfully!",
                "success"
            );


            salesForm.reset();


            salesForm.classList.remove(
                "was-validated"
            );


            // Keep location for next entry.
            state.locationReady =
                true;


            updateLocationDisplay();


        } catch (error) {

            console.error(
                "Submit error:",
                error
            );


            showAlert(
                error.message ||
                "Unable to save sales data.",
                "danger"
            );


        } finally {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Submit Sales Data";
        }
    }
);


// ---------------------------------------------------------
// INITIALIZE LOCATION
// ---------------------------------------------------------

window.addEventListener(
    "load",
    () => {

        getCurrentLocation();
    }
);