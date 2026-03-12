import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import UploadZone from "@/components/landing/UploadZone";
import WhyVisualizingMatters from "@/components/landing/WhyVisualizingMatters";
import Footer from "@/components/landing/Footer";
import AuthModal from "@/components/AuthModal";

const LandingPage = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // If logged in, CTA actions go straight to scan; otherwise open auth
  const handleCta = () => {
    if (user) {
      navigate("/scan");
    } else {
      setAuthOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark text-white font-display">
      <Navbar onAuthOpen={() => setAuthOpen(true)} />
      <HeroSection onAuthOpen={handleCta} />
      <HowItWorks />
      <UploadZone onAuthOpen={handleCta} />
      <WhyVisualizingMatters />
      <Footer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};

export default LandingPage;
