import { generateWorld } from "@/lib/demo/generate";
import type { World } from "@/lib/domain";

const worldStore = globalThis as typeof globalThis & { __foodooWorld?: World };

export function getWorld(): World {
  if (!worldStore.__foodooWorld) worldStore.__foodooWorld = generateWorld();
  return worldStore.__foodooWorld;
}
