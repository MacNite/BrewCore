import { redirect } from "next/navigation";

/** Convenience entry (§20): the brew setup with this recipe pre-selected. */
export default async function RecipeBrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/brew/new?recipeId=${encodeURIComponent(id)}`);
}
