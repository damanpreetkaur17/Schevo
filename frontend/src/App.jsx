import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import WhoBenefits from "./components/WhoBenefits";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

import "./App.css";

function App() {
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

export default App;
