
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import WhoBenefits from "./components/WhoBenefits";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

import Auth from "./pages/Auth";

import "./App.css";

function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <WhoBenefits />
        <CTA />
        <Footer />
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Auth mode="login" />} />

        <Route path="/signup" element={<Auth mode="signup" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
