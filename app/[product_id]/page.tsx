import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ product_id: string }> }) {
  const { product_id } = await params;
  redirect(`/leads/${product_id}`);
}
