import { Injectable, signal, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import {
  CBAContract,
  BargainingUnit,
  CBAArticle,
  StepDeadlineConfig,
} from '@union-local/shared';

@Injectable({
  providedIn: 'root',
})
export class CBAService {
  private firebase = inject(FirebaseService);

  public readonly contracts = signal<CBAContract[]>([]);
  public readonly selectedContract = signal<CBAContract | null>(null);
  public readonly bargainingUnits = signal<BargainingUnit[]>([]);
  public readonly articles = signal<CBAArticle[]>([]);
  public readonly isLoading = signal<boolean>(false);

  public async loadCBAData(): Promise<void> {
    this.isLoading.set(true);
    try {
      // 1. Load Bargaining Units
      const buSnap = await getDocs(
        collection(this.firebase.firestore, 'bargaining_units'),
      );
      const units: BargainingUnit[] = [];
      buSnap.forEach((d) =>
        units.push({ ...(d.data() as BargainingUnit), id: d.id }),
      );
      this.bargainingUnits.set(units);

      // 2. Load CBA Contracts
      const cbaSnap = await getDocs(
        collection(this.firebase.firestore, 'cba_contracts'),
      );
      const cbaList: CBAContract[] = [];
      cbaSnap.forEach((d) =>
        cbaList.push({ ...(d.data() as CBAContract), id: d.id }),
      );
      this.contracts.set(cbaList);

      if (cbaList.length > 0) {
        const currentSelectedId = this.selectedContract()?.id;
        const current =
          cbaList.find((c) => c.id === currentSelectedId) || cbaList[0];
        this.selectedContract.set(current);
        this.articles.set(current.articles || []);
      } else {
        this.selectedContract.set(null);
        this.articles.set([]);
      }
    } catch (err) {
      console.error('Error loading CBA data:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  public setSelectedContract(contractId: string): void {
    const found = this.contracts().find((c) => c.id === contractId);
    if (found) {
      this.selectedContract.set(found);
      this.articles.set(found.articles || []);
    }
  }

  public async updateDeadlines(
    contractId: string,
    deadlines: StepDeadlineConfig,
  ): Promise<void> {
    const contractRef = doc(
      this.firebase.firestore,
      'cba_contracts',
      contractId,
    );
    await updateDoc(contractRef, { deadlines });
    await this.loadCBAData();
  }

  public async saveArticle(
    contractId: string,
    article: CBAArticle,
    originalArticleNumber?: string,
  ): Promise<void> {
    const contract =
      this.contracts().find((c) => c.id === contractId) ||
      this.selectedContract();
    if (!contract) throw new Error('Contract not found');

    let updatedArticles: CBAArticle[] = [...(contract.articles || [])];

    if (originalArticleNumber) {
      // Editing existing article
      const index = updatedArticles.findIndex(
        (a) => a.articleNumber === originalArticleNumber,
      );
      if (index >= 0) {
        updatedArticles[index] = article;
      } else {
        updatedArticles.push(article);
      }
    } else {
      // Adding new article - check if article with same number exists
      const index = updatedArticles.findIndex(
        (a) => a.articleNumber === article.articleNumber,
      );
      if (index >= 0) {
        updatedArticles[index] = article;
      } else {
        updatedArticles.push(article);
      }
    }

    const contractRef = doc(
      this.firebase.firestore,
      'cba_contracts',
      contractId,
    );
    await updateDoc(contractRef, { articles: updatedArticles });
    await this.loadCBAData();
  }

  public async deleteArticle(
    contractId: string,
    articleNumber: string,
  ): Promise<void> {
    const contract =
      this.contracts().find((c) => c.id === contractId) ||
      this.selectedContract();
    if (!contract) throw new Error('Contract not found');

    const updatedArticles = (contract.articles || []).filter(
      (a) => a.articleNumber !== articleNumber,
    );
    const contractRef = doc(
      this.firebase.firestore,
      'cba_contracts',
      contractId,
    );
    await updateDoc(contractRef, { articles: updatedArticles });
    await this.loadCBAData();
  }

  public async saveContract(contract: CBAContract): Promise<void> {
    await setDoc(
      doc(this.firebase.firestore, 'cba_contracts', contract.id),
      contract,
      { merge: true },
    );
    await this.loadCBAData();
  }
}
