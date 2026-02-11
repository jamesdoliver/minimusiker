'use client';

interface MinicardUpsellProps {
  schoolName: string;
  onScrollToShop?: () => void;
}

export default function MinicardUpsell({ schoolName, onScrollToShop }: MinicardUpsellProps) {
  const handleClick = () => {
    if (onScrollToShop) {
      onScrollToShop();
    } else {
      // Scroll to the product selector section
      const shopSection = document.querySelector('#shop-section');
      if (shopSection) {
        shopSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="bg-gradient-to-r from-sage-50 to-sage-100 border-2 border-sage-300 rounded-xl p-6 mt-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-sage-200 flex items-center justify-center">
          <svg className="w-6 h-6 text-sage-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-sage-900">
            Die vollständige Aufnahme freischalten
          </h3>
          <p className="text-sm text-sage-700 mt-1">
            Mit der Minicard erhältst du Zugang zur kompletten Aufnahme deiner Klasse
            sowie zu allen Chor- und Lehrerliedern von {schoolName}.
          </p>
          <button
            onClick={handleClick}
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            Minicard bestellen
          </button>
        </div>
      </div>
    </div>
  );
}
