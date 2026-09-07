// A town's stock is always a single rolled equipment instance - there's nothing to buy in bulk.
export function townStockAffordable(
  price: number,
  goldQuantity: number,
): boolean {
  return goldQuantity >= price;
}
