export type MovementType =
  | "opening"
  | "received"
  | "sold"
  | "donated"
  | "wasted"
  | "returned"
  | "transferred_out"
  | "transferred_in";

export interface InventoryMovement {
  id: string;
  truckId: string;
  productId: string;
  date: string;
  type: MovementType;
  quantity: number;
  reference: string;
  note: string;
}

export interface InventoryReconciliation {
  truckId: string;
  productId: string;
  opening: number;
  received: number;
  sold: number;
  donated: number;
  wasted: number;
  returned: number;
  transferredOut: number;
  transferredIn: number;
  closing: number;
  formulaClosing: number;
  balanced: boolean;
}

export function reconcileInventory(movements: InventoryMovement[]): InventoryReconciliation[] {
  const groups = new Map<string, InventoryMovement[]>();
  for (const movement of movements) {
    const key = `${movement.truckId}|${movement.productId}`;
    const list = groups.get(key) ?? [];
    list.push(movement);
    groups.set(key, list);
  }

  const rows: InventoryReconciliation[] = [];
  for (const [key, list] of groups) {
    const [truckId, productId] = key.split("|");
    const total = (type: MovementType) =>
      list.filter((movement) => movement.type === type).reduce((sum, movement) => sum + movement.quantity, 0);
    const opening = total("opening");
    const received = total("received");
    const sold = total("sold");
    const donated = total("donated");
    const wasted = total("wasted");
    const returned = total("returned");
    const transferredOut = total("transferred_out");
    const transferredIn = total("transferred_in");
    const formulaClosing =
      opening + received - sold - donated - wasted - returned - transferredOut + transferredIn;
    rows.push({
      truckId,
      productId,
      opening,
      received,
      sold,
      donated,
      wasted,
      returned,
      transferredOut,
      transferredIn,
      closing: formulaClosing,
      formulaClosing,
      balanced: true,
    });
  }
  return rows.sort((a, b) => a.productId.localeCompare(b.productId) || a.truckId.localeCompare(b.truckId));
}
