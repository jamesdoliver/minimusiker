'use client';

import { useState } from 'react';
import { Product, Order } from '@/types/airtable';
import { formatPrice } from '@/lib/utils';
import CheckoutButton from './CheckoutButton';

interface ProductGridProps {
  products: Product[];
  eventId: string;
  parentId: string;
  existingOrders?: Order[];
}

export default function ProductGrid({ products, eventId, parentId, existingOrders = [] }: ProductGridProps) {
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { quantity: number; size?: string }>>(
    new Map()
  );

  const handleProductSelect = (productId: string, quantity: number, size?: string) => {
    const newSelection = new Map(selectedProducts);
    if (quantity === 0) {
      newSelection.delete(productId);
    } else {
      newSelection.set(productId, { quantity, size });
    }
    setSelectedProducts(newSelection);
  };

  const calculateTotal = () => {
    let total = 0;
    selectedProducts.forEach((selection, productId) => {
      const product = products.find(p => p.product_id === productId);
      if (product) {
        const price = product.early_bird_price && new Date() < new Date(product.early_bird_deadline || '')
          ? product.early_bird_price
          : product.price;
        total += price * selection.quantity;
      }
    });
    return total;
  };

  const hasOrderedProduct = (productId: string) => {
    return existingOrders.some(order =>
      order.products.some(p => p.product_id === productId)
    );
  };

  const groupedProducts = products.reduce((acc, product) => {
    const type = product.product_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedProducts).map(([type, typeProducts]) => (
        <div key={type}>
          <h3 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
            {type === 'tshirt' ? 'T-Shirts' : type === 'recording' ? 'Recordings' : type}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {typeProducts.map((product) => {
              const isEarlyBird = product.early_bird_price &&
                product.early_bird_deadline &&
                new Date() < new Date(product.early_bird_deadline);
              const currentPrice = isEarlyBird ? product.early_bird_price! : product.price;
              const hasOrdered = hasOrderedProduct(product.product_id);
              const selection = selectedProducts.get(product.product_id);

              return (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {product.image_url && (
                    <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                      <img
                        src={product.image_url}
                        alt={product.description}
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {product.description}
                    </h4>

                    {hasOrdered && (
                      <div className="mb-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Purchased
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {formatPrice(currentPrice * 100)}
                        </span>
                        {isEarlyBird && (
                          <span className="text-sm text-gray-500 line-through">
                            {formatPrice(product.price * 100)}
                          </span>
                        )}
                      </div>
                      {isEarlyBird && (
                        <p className="text-sm text-green-600 mt-1">
                          Early bird price! Ends {new Date(product.early_bird_deadline!).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {product.product_type === 'tshirt' && product.sizes_available && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Size
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          value={selection?.size || ''}
                          onChange={(e) => handleProductSelect(
                            product.product_id,
                            selection?.quantity || 1,
                            e.target.value
                          )}
                        >
                          <option value="">Select size</option>
                          {product.sizes_available.map(size => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <label className="text-sm font-medium text-gray-700">Quantity:</label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleProductSelect(
                            product.product_id,
                            Math.max(0, (selection?.quantity || 0) - 1),
                            selection?.size
                          )}
                          className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-medium">
                          {selection?.quantity || 0}
                        </span>
                        <button
                          onClick={() => handleProductSelect(
                            product.product_id,
                            (selection?.quantity || 0) + 1,
                            selection?.size || (product.sizes_available?.[0])
                          )}
                          className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedProducts.size > 0 && (
        <div className="sticky bottom-0 bg-white border-t shadow-lg p-4 mt-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {selectedProducts.size} item{selectedProducts.size !== 1 ? 's' : ''} selected
              </p>
              <p className="text-2xl font-bold text-gray-900">
                Total: {formatPrice(calculateTotal() * 100)}
              </p>
            </div>
            <CheckoutButton
              selectedProducts={Array.from(selectedProducts.entries()).map(([productId, selection]) => ({
                productId,
                ...selection,
              }))}
              products={products}
              parentId={parentId}
              eventId={eventId}
            />
          </div>
        </div>
      )}
    </div>
  );
}