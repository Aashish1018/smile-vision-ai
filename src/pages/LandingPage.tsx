import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import UploadZone from "@/components/landing/UploadZone";
import WhyVisualizingMatters from "@/components/landing/WhyVisualizingMatters";
import Footer from "@/components/landing/Footer";

const LandingPage = () => (
  <div className="min-h-screen bg-background-dark text-white font-display">
    <Navbar />
    <HeroSection />
    <HowItWorks />
    <UploadZone />
    <WhyVisualizingMatters />
    <Footer />
  </div>
);

export default LandingPage;
