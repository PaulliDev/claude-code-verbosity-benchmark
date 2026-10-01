import { addTax } from "./money.ts";

export interface CartItem {
  sku: string;
  unitPrice: number;
  quantity: number;
}

export class Cart {
  private readonly items: CartItem[] = [];
  private discountPercent = 0;

  public addItem(item: CartItem): void {
    this.items.push(item);
  }

  public applyDiscount(percent: number): void {
    this.discountPercent += percent;
  }

  public netTotal(): number {
    const subtotal = this.items.reduce(
      (sum: number, item: CartItem) => sum + item.unitPrice * item.quantity,
      0
    );

    return subtotal * (1 - this.discountPercent / 100);
  }

  public grossTotal(): number {
    return addTax(this.netTotal());
  }
}
