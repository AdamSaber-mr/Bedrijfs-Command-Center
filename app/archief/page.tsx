import { redirect } from "next/navigation";

// Het archief leeft tegenwoordig als tabblad in Instellingen (zoals bij Claude).
export default function ArchiveRedirect() {
  redirect("/settings?tab=archief");
}
