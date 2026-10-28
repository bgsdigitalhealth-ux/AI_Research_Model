export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // ServiceWorker registered
        })
        .catch(() => {
          // Registration failed or unsupported
        });
    });
  }
}

