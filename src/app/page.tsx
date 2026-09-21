import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import StatementSection from '@/components/StatementSection';
import AboutSection from '@/components/AboutSection';
import CapabilitiesSection from '@/components/CapabilitiesSection';
import ModelSection from '@/components/ModelSection';
import CharteringSection from '@/components/CharteringSection';
import ProjectsSection from '@/components/ProjectsSection';
import AmbitionSection from '@/components/AmbitionSection';
import GlobalPresence from '@/components/GlobalPresence';
import SustainabilitySection from '@/components/SustainabilitySection';
import LeadershipSection from '@/components/LeadershipSection';
import ContactSection from '@/components/ContactSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatementSection />
        <AboutSection />
        <CapabilitiesSection />
        <ModelSection />
        <CharteringSection />
        <ProjectsSection />
        <AmbitionSection />
        <GlobalPresence />
        <SustainabilitySection />
        <LeadershipSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
