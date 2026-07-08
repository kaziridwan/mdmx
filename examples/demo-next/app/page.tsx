import { redirect } from "next/navigation";

// The dashboard is the app: everything lives under /mdmx.
export default function Home() {
  redirect("/mdmx");
}
