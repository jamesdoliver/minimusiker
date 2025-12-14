import BundleOffer from '@/components/parent-portal/BundleOffer';

export default function TestBundlePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-heading font-bold text-minimusik-heading mb-8">
          Bundle Offer Component Test
        </h1>

        <BundleOffer
          eventId="test-event"
          parentId="test-parent"
          schoolName="Springfield Elementary School"
          products={[]}
        />
      </div>
    </div>
  );
}