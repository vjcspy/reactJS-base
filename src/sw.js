// @ts-ignore
// eslint-disable-next-line no-undef
if (workbox) {
    console.log(`Yay! Workbox is loaded 🎉`);

    // eslint-disable-next-line no-undef,no-restricted-globals
    workbox.precaching.precacheAndRoute(self.__precacheManifest || []);
} else {
    console.log(`Boo! Workbox didn't load 😬`);
}
