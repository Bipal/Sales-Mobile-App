let latitude = null;

let longitude = null;

let locationName = null;


window.addEventListener(
    "load",
    function () {

        captureLocation();

        loadRecords();

    }
);


// =====================================================
// LOCATION
// =====================================================

function captureLocation() {

    showLocationMessage(
        "📍 Requesting your location...",
        "info"
    );


    if (!navigator.geolocation) {

        showLocationMessage(
            "Location is not supported.",
            "danger"
        );

        return;
    }


    navigator.geolocation.getCurrentPosition(

        async function (position) {

            latitude =
                position.coords.latitude;

            longitude =
                position.coords.longitude;


            console.log(
                latitude,
                longitude
            );


            await reverseGeocode();

        },


        function (error) {

            console.log(error);


            showLocationMessage(

                "❌ Location permission is required " +
                "for this POC.",

                "danger"

            );

        },


        {

            enableHighAccuracy:
                true,

            timeout:
                15000,

            maximumAge:
                0

        }

    );

}


// =====================================================
// REVERSE GEOCODING
// =====================================================

async function reverseGeocode() {

    try {

        const response =
            await fetch(

                `/reverse-geocode` +
                `?lat=${latitude}` +
                `&lon=${longitude}`

            );


        const data =
            await response.json();


        locationName =
            data.location_name;


        document.getElementById(
            "locationDisplay"
        ).innerHTML =

            `📍 ${locationName}`;


        showLocationMessage(

            `✅ Location captured: ${locationName}`,

            "success"

        );

    }

    catch (error) {

        console.error(error);


        locationName =
            "Location detected";


        showLocationMessage(

            "⚠️ Coordinates captured, " +
            "but location name unavailable.",

            "warning"

        );

    }

}


// =====================================================
// FORM SUBMISSION
// =====================================================

document
    .getElementById("salesForm")
    .addEventListener(

        "submit",

        async function (event) {

            event.preventDefault();


            if (
                latitude === null ||
                longitude === null
            ) {

                showMessage(

                    "Please allow location access first.",

                    "warning"

                );

                return;

            }


            const data = {

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
                    latitude,

                longitude:
                    longitude,

                location_name:
                    locationName

            };


            try {

                const response =
                    await fetch(

                        "/submit",

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(data)

                        }

                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.message
                    );

                }


                showMessage(

                    "✅ Sales record saved successfully!",

                    "success"

                );


                document
                    .getElementById(
                        "salesForm"
                    )
                    .reset();


                loadRecords();

            }

            catch (error) {

                showMessage(

                    "❌ " +
                    error.message,

                    "danger"

                );

            }

        }

    );


// =====================================================
// GET RECORDS
// =====================================================

async function loadRecords() {

    try {

        const response =
            await fetch(
                "/entries"
            );


        const records =
            await response.json();


        const container =
            document.getElementById(
                "records"
            );


        container.innerHTML = "";


        records.forEach(

            function (record) {

                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "record";


                div.innerHTML = `

                    <strong>
                        ${record.customer_name}
                    </strong>

                    <div>
                        ${record.product}
                    </div>

                    <div>
                        Sales:
                        ₹${record.sales.toLocaleString()}
                    </div>

                    <div>
                        Profit:
                        ₹${record.profit.toLocaleString()}
                    </div>

                    <small>
                        📍 ${record.location_name}
                    </small>

                `;


                container.appendChild(
                    div
                );

            }

        );

    }

    catch (error) {

        console.error(error);

    }

}


// =====================================================
// REFRESH EVERY 2 SECONDS
// =====================================================

setInterval(

    loadRecords,

    2000

);


// =====================================================
// HELPERS
// =====================================================

function getValue(id) {

    return document
        .getElementById(id)
        .value;

}


function showMessage(
    text,
    type
) {

    document
        .getElementById(
            "message"
        )
        .innerHTML = `

            <div
                class="alert
                       alert-${type}">

                ${text}

            </div>

        `;

}


function showLocationMessage(
    text,
    type
) {

    document
        .getElementById(
            "locationMessage"
        )
        .innerHTML = `

            <div
                class="alert
                       alert-${type}">

                ${text}

            </div>

        `;

}
