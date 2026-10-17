import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "RealityOS — The Cognitive OS for Intelligent Infrastructure",
  description:
    "Turn infrastructure requirements into explainable planning strategy with AI agents, geographic intelligence, reproducible simulation, and exportable evidence.",
};

export default function LandingPage() {
  return <Landing />;
}
