const CACHE_NAME =
    "sales-poc-v1";


const APP_FILES = [

    "/",

    "/static/script.js",

    "/static/manifest.json",

    "/static/icons/icon-192.png",

    "/static/icons/icon-512.png"

];


self.addEventListener(
    "install",

    function (event) {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(

                    function (cache) {

                        return cache.addAll(
                            APP_FILES
                        );

                    }

                )

        );

    }

);


self.addEventListener(
    "activate",

    function (event) {

        event.waitUntil(

            caches.keys()
                .then(

                    function (keys) {

                        return Promise.all(

                            keys
                                .filter(
                                    key =>
                                    key !== CACHE_NAME
                                )

                                .map(
                                    key =>
                                    caches.delete(key)
                                )

                        );

                    }

                )

        );

    }

);


self.addEventListener(
    "fetch",

    function (event) {

        event.respondWith(

            fetch(event.request)
                .catch(

                    function () {

                        return caches.match(
                            event.request
                        );

                    }

                )

        );

    }

);
