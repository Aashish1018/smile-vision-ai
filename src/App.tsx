import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import ScanPage from "./pages/ScanPage";
import AnalysisPage from "./pages/AnalysisPage";
import SharePage from "./pages/SharePage";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/analysis/:id" element={<AnalysisPage />} />
      <Route path="/share/:id" element={<SharePage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
