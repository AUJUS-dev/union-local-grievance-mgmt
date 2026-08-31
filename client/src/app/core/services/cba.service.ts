import { Injectable, signal, inject } from '@angular/core';
import { collection, doc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { CBAContract, BargainingUnit, CBAArticle } from '@union-local/shared';

@Injectable({
  providedIn: 'root'
})
export class CBAService {
  private firebase = inject(FirebaseService);

  public readonly contracts = signal<CBAContract[]>([]);
  public readonly bargainingUnits = signal<BargainingUnit[]>([]);
  public readonly articles = signal<CBAArticle[]>([]);
  public readonly isLoading = signal<boolean>(false);

  public async loadCBAData(): Promise<void> {
    this.isLoading.set(true);
    try {
      // 1. Load Bargaining Units
      const buSnap = await getDocs(collection(this.firebase.firestore, 'bargaining_units'));
      const units: BargainingUnit[] = [];
      buSnap.forEach((d) => units.push({ ...(d.data() as BargainingUnit), id: d.id }));
      this.bargainingUnits.set(units);

      // 2. Load CBA Contracts
      const cbaSnap = await getDocs(collection(this.firebase.firestore, 'cba_contracts'));
      const cbaList: CBAContract[] = [];
      cbaSnap.forEach((d) => cbaList.push({ ...(d.data() as CBAContract), id: d.id }));
      this.contracts.set(cbaList);

      if (cbaList.length > 0) {
        this.articles.set(cbaList[0].articles || []);
      }
    } catch (err) {
      console.error('Error loading CBA data:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async saveContract(contract: CBAContract): Promise<void> {
    await setDoc(doc(this.firebase.firestore, 'cba_contracts', contract.id), contract, { merge: true });
    await this.loadCBAData();
  }
}
