/**
 * Economy Service - Manages wallet, transactions, marketplace
 */

import { Wallet, Transaction, MarketplaceItem } from '../types/system.types';
import { randomUUID } from 'crypto';

export class EconomyService {
  private static wallet: Wallet = {
    capital: 1450.00,
    currency: '₵',
    transactions: [],
    balance: 1450.00
  };

  private static marketplace: MarketplaceItem[] = [
    {
      id: 'mesh-router-1',
      name: 'Mesh-Роутер "Спутник"',
      price: 5000,
      currency: '₵',
      category: 'hardware',
      description: 'Автономная связь до 5км',
      available: true
    },
    {
      id: 'dosimeter-1',
      name: 'Дозиметр "Луч"',
      price: 2500,
      currency: '₵',
      category: 'hardware',
      description: 'Карманный детектор',
      available: true
    }
  ];

  /**
   * Get wallet
   */
  static getWallet(): Wallet {
    return { ...this.wallet };
  }

  /**
   * Add transaction
   */
  static addTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>): Transaction {
    const newTransaction: Transaction = {
      ...transaction,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };

    this.wallet.transactions.unshift(newTransaction);

    // Update balance
    if (transaction.status === 'completed') {
      if (transaction.type === 'deposit' || transaction.type === 'staking') {
        this.wallet.balance += transaction.amount;
        this.wallet.capital += transaction.amount;
      } else if (transaction.type === 'withdraw' || transaction.type === 'purchase') {
        this.wallet.balance -= transaction.amount;
      }
    }

    // Keep only last 100 transactions
    if (this.wallet.transactions.length > 100) {
      this.wallet.transactions = this.wallet.transactions.slice(0, 100);
    }

    return newTransaction;
  }

  /**
   * Get transactions
   */
  static getTransactions(limit = 50): Transaction[] {
    return this.wallet.transactions.slice(0, limit);
  }

  /**
   * Deposit funds
   */
  static deposit(amount: number, description?: string): Transaction {
    return this.addTransaction({
      type: 'deposit',
      amount,
      currency: this.wallet.currency,
      status: 'completed',
      description: description || 'Пополнение баланса'
    });
  }

  /**
   * Withdraw funds
   */
  static withdraw(amount: number, description?: string): Transaction {
    if (this.wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    return this.addTransaction({
      type: 'withdraw',
      amount,
      currency: this.wallet.currency,
      status: 'completed',
      description: description || 'Вывод средств'
    });
  }

  /**
   * Exchange currency
   */
  static exchange(fromAmount: number, toCurrency: string, rate: number): Transaction {
    return this.addTransaction({
      type: 'exchange',
      amount: fromAmount,
      currency: toCurrency,
      status: 'completed',
      description: `Обмен по курсу ${rate}`
    });
  }

  /**
   * Staking
   */
  static stake(amount: number, duration: number): Transaction {
    return this.addTransaction({
      type: 'staking',
      amount,
      currency: this.wallet.currency,
      status: 'pending',
      description: `Стейкинг на ${duration} дней`
    });
  }

  /**
   * Purchase marketplace item
   */
  static purchase(itemId: string): Transaction {
    const item = this.marketplace.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    if (!item.available) {
      throw new Error('Item not available');
    }
    if (this.wallet.balance < item.price) {
      throw new Error('Insufficient balance');
    }

    const transaction = this.addTransaction({
      type: 'purchase',
      amount: item.price,
      currency: item.currency,
      status: 'completed',
      description: `Покупка: ${item.name}`
    });

    return transaction;
  }

  /**
   * Get marketplace items
   */
  static getMarketplace(): MarketplaceItem[] {
    return [...this.marketplace];
  }

  /**
   * Get marketplace item
   */
  static getMarketplaceItem(itemId: string): MarketplaceItem | null {
    return this.marketplace.find(i => i.id === itemId) || null;
  }
}

