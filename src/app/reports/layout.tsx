import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

// Public report pages share the site's navigation and footer. The navbar is
// solid here (no hero behind it) and its section links point back to "/#…".
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
