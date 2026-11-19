import { useCallback, useEffect, useRef, useState } from 'react';
import { OpeningSequence } from './components/OpeningSequence';
import { AdminImport } from './components/AdminImport';
import { CartDrawer } from './components/CartDrawer';
import { Catalog } from './components/Catalog';
import { CareShortcuts } from './components/CareShortcuts';
import { CategoryGrid } from './components/CategoryGrid';
import { CheckoutModal } from './components/CheckoutModal';
import { FloatingWhatsApp, InstagramHint, MobileBottomBar, Toasts } from './components/Extras';
import { FamilySection } from './components/FamilySection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { MascotBanner } from './components/MascotBanner';
import { Offers } from './components/Offers';
import { ProductModal } from './components/ProductModal';
import { CartProvider, CatalogProvider, UIProvider } from './state/store';
import { VoiceProvider } from './state/voice';

export default function App() {
  const [opening, setOpening] = useState(true);
  const returnFocus = useRef(false);
  const finishOpening = useCallback(() => {
    returnFocus.current = document.activeElement?.closest('.sm-opening') != null;
    setOpening(false);
  }, []);
  useEffect(() => {
    if (!opening && returnFocus.current) {
      const destination = document.querySelector<HTMLElement>('.storefront-app [role="dialog"] button')
        ?? document.querySelector<HTMLElement>('#site-header a[href="#inicio"]');
      destination?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
  }, [opening]);

  return (
    <>
      {opening && <OpeningSequence onFinish={finishOpening} />}
      <CatalogProvider>
        <CartProvider>
          <UIProvider>
            <VoiceProvider>
              <div inert={opening} aria-hidden={opening || undefined} className="storefront-app bg-[#F8FAFC] text-slate-900">
                <a href="#produtos" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:p-3 focus:font-bold">
                  Pular para os produtos
                </a>
                <InstagramHint />
                <Header />
                <div id="storefront-content" className="storefront-scroll">
                  <main id="inicio">
                    <CareShortcuts />
                    <Hero />
                    <CategoryGrid />
                    <Offers />
                    <FamilySection />
                    <Catalog />
                    <MascotBanner />
                  </main>
                  <Footer />
                </div>
                <CartDrawer />
                <CheckoutModal />
                <ProductModal />
                <AdminImport />
                <Toasts />
                <MobileBottomBar />
                <FloatingWhatsApp />
              </div>
            </VoiceProvider>
          </UIProvider>
        </CartProvider>
      </CatalogProvider>
    </>
  );
}
