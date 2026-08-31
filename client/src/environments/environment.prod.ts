export const environment = {
  production: true,
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "demo-union-local.firebaseapp.com",
    projectId: "demo-union-local",
    storageBucket: "demo-union-local.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
  },
  useEmulators: false,
  emulatorHosts: {
    auth: "http://127.0.0.1:9099",
    firestore: "127.0.0.1:8080",
    functions: "127.0.0.1:5001"
  }
};
