import { useEffect } from 'react';
import { useStore } from '@/store/useAnalysisStore';
import { Navbar } from '@/components/landing/Navbar';
import { UploadSection } from '@/components/landing/UploadSection';
import { Features, About, CharacterReference, HowItWorks, Privacy, Footer } from '@/components/landing/Sections';
import { AnalysisScreen } from '@/components/analysis/AnalysisScreen';
import { Workspace } from '@/components/workspace/Workspace';
import { Toast } from '@/components/ui/Toast';

export default function App() {
  const screen = useStore((s) => s.screen);
  const theme = useStore((s) => s.theme);
  const result = useStore((s) => s.result);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (screen === 'analyzing') {
    return <AnalysisScreen />;
  }

  if (screen === 'workspace' && result) {
    return (
      <>
        <Workspace result={result} />
        <Toast />
      </>
    );
  }

  return (
    <>
      <div className="min-h-dvh">
        <Navbar />
        <main>
          <UploadSection />
          <Features />
          <About />
          <CharacterReference />
          <HowItWorks />
          <Privacy />
        </main>
        <Footer />
      </div>
      <Toast />
    </>
  );
}
