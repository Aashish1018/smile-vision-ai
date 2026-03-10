import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import UploadZone from "@/components/landing/UploadZone";
import WhyVisualizingMatters from "@/components/landing/WhyVisualizingMatters";
import Footer from "@/components/landing/Footer";
import AuthModal from "@/components/AuthModal";

const LandingPage = () => {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-dark text-white font-display">
      <Navbar onAuthOpen={() => setAuthOpen(true)} />
      <HeroSection onAuthOpen={() => setAuthOpen(true)} />
      <HowItWorks />
      <UploadZone onAuthOpen={() => setAuthOpen(true)} />
      <WhyVisualizingMatters />
      <Footer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

export default LandingPage;
