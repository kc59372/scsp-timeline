import { redirect } from "next/navigation";

// The site is timeline-only; the root redirects to the timeline page.
export default function Home() {
  redirect("/timeline");
}
