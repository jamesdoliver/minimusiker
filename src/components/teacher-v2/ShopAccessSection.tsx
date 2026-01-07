'use client';

interface ShopAccessSectionProps {
  discountCode?: string;
  shopUrl?: string;
}

export function ShopAccessSection({
  discountCode = 'KEH1038US',
  shopUrl = 'https://shop.minimusiker.de',
}: ShopAccessSectionProps) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Zugriff auf Songs & Playbacks
        </h2>

        <p className="text-gray-600 leading-relaxed mb-8 max-w-3xl">
          Mit diesem Code erhalten Sie Zugriff auf alle Songs und Playbacks für
          Ihren Minimusikertag. Geben Sie den Code einfach im Shop ein.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Shop button */}
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-mm-accent text-white font-medium rounded-lg hover:bg-mm-accent/90 transition-colors"
          >
            zum Shop
          </a>

          {/* Discount code box */}
          <div className="px-8 py-4 border-2 border-dashed border-gray-300 rounded-xl bg-white">
            <span className="text-2xl font-bold tracking-wider text-gray-900">
              {discountCode}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ShopAccessSection;
