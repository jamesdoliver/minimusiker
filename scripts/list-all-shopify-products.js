#!/usr/bin/env node
/**
 * List ALL Shopify products (no tag filter)
 */

require('dotenv').config({ path: '.env.local' });

const storeDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

async function main() {
  const query = `
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            handle
            tags
            availableForSale
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 20) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${storeDomain}/api/2025-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Shopify-Storefront-Private-Token': storefrontToken,
      },
      body: JSON.stringify({ query }),
    }
  );

  const json = await response.json();

  if (json.errors) {
    console.error('Error:', json.errors);
    return;
  }

  console.log('All Shopify Products:');
  console.log('=====================');

  json.data.products.edges.forEach(({ node: product }) => {
    console.log(`\n${product.title}`);
    console.log(`  Handle: ${product.handle}`);
    console.log(`  Tags: ${product.tags.join(', ') || 'none'}`);
    console.log(`  Available: ${product.availableForSale}`);
    console.log(`  Price: €${product.priceRange.minVariantPrice.amount}`);
    console.log(`  Variants:`);
    product.variants.edges.forEach(({ node: variant }) => {
      const options = variant.selectedOptions.map(o => `${o.name}: ${o.value}`).join(', ');
      console.log(`    - ${variant.title} (€${variant.price.amount}) [${options}]`);
      console.log(`      ID: ${variant.id}`);
    });
  });
}

main();
