import { listGrinderModels } from "@/server/grinders";

export async function grinderModelOptions(userId: string) {
  const models = await listGrinderModels(userId);
  return models.map((m) => ({ id: m.id, label: `${m.manufacturer} ${m.model}`, custom: m.ownerId !== null }));
}
