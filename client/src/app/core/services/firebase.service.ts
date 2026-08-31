import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  public readonly app: FirebaseApp;
  public readonly auth: Auth;
  public readonly firestore: Firestore;
  public readonly functions: Functions;

  private emulatorsConnected = false;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    this.functions = getFunctions(this.app);

    if (environment.useEmulators && !this.emulatorsConnected) {
      try {
        connectAuthEmulator(this.auth, environment.emulatorHosts.auth, { disableWarnings: true });
        const [fsHost, fsPort] = environment.emulatorHosts.firestore.split(':');
        connectFirestoreEmulator(this.firestore, fsHost, parseInt(fsPort, 10));
        const [fnHost, fnPort] = environment.emulatorHosts.functions.split(':');
        connectFunctionsEmulator(this.functions, fnHost, parseInt(fnPort, 10));
        this.emulatorsConnected = true;
        console.log('⚡ Connected to Firebase Local Emulators');
      } catch (err) {
        console.warn('Firebase emulator connection note:', err);
      }
    }
  }
}
