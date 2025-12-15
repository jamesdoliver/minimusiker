'use client';

import { useState } from 'react';
import { Product, ParentSessionChild } from '@/types/airtable';

interface BundleOfferProps {
  eventId: string;
  parentId: string;
  schoolName: string;
  products?: Product[];
  children?: ParentSessionChild[]; // Multi-child support
}

export default function BundleOffer({
  eventId,
  parentId,
  schoolName,
  products = [],
  children = [],
}: BundleOfferProps) {
  // For multi-child: track size for each child
  const childCount = children.length > 0 ? children.length : 1;
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>(
    Object.fromEntries(Array.from({ length: childCount }, (_, i) => [i, 'M']))
  );
  const [isAdding, setIsAdding] = useState(false);

  // Available t-shirt sizes
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Bundle pricing - per child
  const tshirtPrice = 19.99;
  const recordingPrice = 9.99;
  const pricePerChild = tshirtPrice; // Recording is FREE with t-shirt!
  const bundlePrice = pricePerChild * childCount;
  const savingsPerChild = recordingPrice;
  const totalSavings = savingsPerChild * childCount;

  const updateChildSize = (childIndex: number, size: string) => {
    setSelectedSizes(prev => ({
      ...prev,
      [childIndex]: size,
    }));
  };

  const handleAddToCart = async () => {
    setIsAdding(true);

    // Simulate adding to cart
    // In production, this would integrate with your Shopify checkout
    setTimeout(() => {
      setIsAdding(false);
      // Show success message or redirect to checkout
      const sizesList = Object.values(selectedSizes).join(', ');
      alert(`Bundle added to cart! ${childCount} t-shirt(s) in size(s): ${sizesList}`);
    }, 1000);
  };

  return (
    <div className="bg-gradient-to-br from-sage-50 to-cream-100 rounded-xl shadow-xl p-6 border-2 border-sage-200">
      {/* Special Offer Badge */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Special Bundle Offer</h3>
          <p className="text-gray-600 mt-1">
            {childCount > 1 ? `${childCount} children - Limited time only!` : 'Limited time only!'}
          </p>
        </div>
        <div className="bg-sage-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
          SAVE ${totalSavings.toFixed(2)}
        </div>
      </div>

      {/* Offer Description */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-sage-200">
        <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-2">
          <span className="text-2xl">🎁</span>
          <span>Buy T-Shirt{childCount > 1 ? 's' : ''}, Get Recording{childCount > 1 ? 's' : ''} FREE!</span>
        </div>
        <p className="text-gray-600">
          {childCount > 1 ? (
            <>
              Purchase {childCount} event t-shirts and receive {childCount} full {schoolName} recordings
              at no additional cost. That's ${totalSavings.toFixed(2)} in FREE recordings!
            </>
          ) : (
            <>
              Purchase your child's event t-shirt and receive the full {schoolName} recording
              at no additional cost. That's a ${recordingPrice.toFixed(2)} value absolutely FREE!
            </>
          )}
        </p>
      </div>

      {/* Product Display */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-4 mb-6">
        {/* T-Shirt */}
        <div className="bg-white rounded-lg p-4 text-center flex-1 max-w-xs mx-auto md:mx-0">
          <div className="w-24 h-24 bg-gray-200 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <span className="text-4xl">👕</span>
          </div>
          <h4 className="font-semibold text-gray-900">Event T-Shirt</h4>
          <p className="text-sm text-gray-600">Premium quality</p>
          <p className="text-lg font-bold text-gray-900 mt-2">${tshirtPrice.toFixed(2)}</p>
        </div>

        {/* Plus Sign - Desktop */}
        <div className="hidden md:flex items-center justify-center flex-shrink-0 px-4">
          <div className="text-3xl text-sage-600 font-bold">+</div>
        </div>

        {/* Plus Sign - Mobile */}
        <div className="flex md:hidden items-center justify-center py-2">
          <div className="text-2xl text-sage-600 font-bold">+</div>
        </div>

        {/* Recording */}
        <div className="bg-white rounded-lg p-4 text-center relative flex-1 max-w-xs mx-auto md:mx-0">
          <div className="absolute top-2 right-2 bg-sage-500 text-white text-xs px-2 py-1 rounded-full font-bold">
            FREE
          </div>
          <div className="w-24 h-24 bg-gray-200 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <span className="text-4xl">🎵</span>
          </div>
          <h4 className="font-semibold text-gray-900">Full Recording</h4>
          <p className="text-sm text-gray-600">Digital download</p>
          <p className="text-lg font-bold text-gray-400 line-through mt-2">${recordingPrice.toFixed(2)}</p>
        </div>
      </div>

      {/* Size Selection */}
      <div className="mb-6 space-y-4">
        {childCount > 1 ? (
          // Multi-child size selectors
          children.map((child, index) => (
            <div key={child.bookingId}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                T-Shirt Size for {child.childName}
                {child.class && <span className="text-gray-500 ml-1">({child.class})</span>}
              </label>
              <div className="grid grid-cols-6 gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => updateChildSize(index, size)}
                    className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                      selectedSizes[index] === size
                        ? 'border-sage-600 bg-sage-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          // Single child size selector
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select T-Shirt Size
            </label>
            <div className="grid grid-cols-6 gap-2">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => updateChildSize(0, size)}
                  className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                    selectedSizes[0] === size
                      ? 'border-sage-600 bg-sage-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Price Summary */}
      <div className="bg-white rounded-lg p-4 mb-6">
        <div className="space-y-2">
          {childCount > 1 ? (
            // Multi-child pricing
            <>
              {children.map((child, index) => (
                <div key={child.bookingId} className="space-y-1">
                  <div className="flex justify-between text-sm font-medium text-gray-700">
                    <span>{child.childName}</span>
                  </div>
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-600">T-Shirt ({selectedSizes[index]})</span>
                    <span className="text-gray-900">${tshirtPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-600">Recording (Digital)</span>
                    <span className="text-sage-600 font-semibold">FREE</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            // Single child pricing
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">T-Shirt ({selectedSizes[0]})</span>
                <span className="text-gray-900">${tshirtPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Recording (Digital)</span>
                <span className="text-sage-600 font-semibold">FREE</span>
              </div>
            </>
          )}
          <div className="border-t pt-2 flex justify-between">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">${bundlePrice.toFixed(2)}</p>
              <p className="text-xs text-sage-600">You save ${totalSavings.toFixed(2)}!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={isAdding}
        className="w-full py-4 px-6 bg-gradient-to-r from-sage-500 to-sage-700 text-white font-button font-bold uppercase tracking-wide rounded-lg shadow-lg hover:from-sage-600 hover:to-sage-800 transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isAdding ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Adding to Cart...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Add Bundle to Cart - ${bundlePrice.toFixed(2)}
          </span>
        )}
      </button>

      {/* Trust Badges */}
      <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-600">
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-1 text-sage-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secure Checkout
        </span>
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-1 text-sage-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
          </svg>
          Fast Delivery
        </span>
      </div>
    </div>
  );
}