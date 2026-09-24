import { listRoasters } from "@/server/roasters";
import { COMMON_PROCESSES } from "@/server/coffees";
import { imageUploadMaxBytes, imageUploadMaxMb } from "@/lib/image-upload-limit";

/** What both the new and the edit coffee form need besides the values. */
export async function coffeeFormContext(userId: string) {
  const roasters = await listRoasters(userId);
  return {
    roasters: roasters.map((r) => r.name),
    processes: COMMON_PROCESSES,
    maxImageBytes: imageUploadMaxBytes(),
    maxImageMb: imageUploadMaxMb(),
  };
}
