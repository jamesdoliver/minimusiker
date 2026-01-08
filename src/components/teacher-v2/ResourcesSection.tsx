'use client';

import { useState, useEffect } from 'react';
import { ResourceCard } from './ResourceCard';

interface TeacherResource {
  resourceKey: string;
  pdfUrl: string;
  displayTitle: string;
}

// Static resource configuration with images
// resource1, resource2, resource3 = PDFs from Airtable
// resource4 = Video (static, links to future training section)
const RESOURCE_CONFIG = [
  {
    key: 'resource1',
    thumbnail: '/images/teacher_portal_resources/Teacher-portal_MATERIAL_1.png',
    type: 'pdf' as const,
    fallbackTitle: 'Liedvorschläge',
  },
  {
    key: 'resource2',
    thumbnail: '/images/teacher_portal_resources/Teacher-portal_MATERIAL_2.png',
    type: 'pdf' as const,
    fallbackTitle: 'Was singen wir?',
  },
  {
    key: 'resource3',
    thumbnail: '/images/teacher_portal_resources/Teacher-portal_MATERIAL_3.png',
    type: 'pdf' as const,
    fallbackTitle: 'Singen mit Kindern',
  },
  {
    key: 'resource4',
    thumbnail: '/images/teacher_portal_resources/Teacher-portal_MATERIAL_4.png',
    type: 'video' as const,
    fallbackTitle: 'Warm Up',
    staticHref: '#', // Will link to training video section in future
  },
];

export function ResourcesSection() {
  const [airtableResources, setAirtableResources] = useState<TeacherResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await fetch('/api/teacher/resources');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAirtableResources(data.resources || []);
        }
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build resources by merging Airtable data with static config
  const resources = RESOURCE_CONFIG.map((config) => {
    // For video (resource4), use static config
    if (config.type === 'video') {
      return {
        id: config.key,
        title: config.fallbackTitle,
        thumbnail: config.thumbnail,
        type: config.type,
        href: config.staticHref || '#',
      };
    }

    // For PDFs, find matching Airtable resource
    const airtableResource = airtableResources.find(
      (r) => r.resourceKey === config.key
    );

    return {
      id: config.key,
      title: airtableResource?.displayTitle || config.fallbackTitle,
      thumbnail: config.thumbnail,
      type: config.type,
      href: airtableResource?.pdfUrl || '#',
    };
  });

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Liedvorschläge & Material
        </h2>

        <p className="text-gray-600 leading-relaxed mb-8 max-w-3xl">
          In den Wochen vor dem Minimusikertag unterstützen wir euch mit Material
          und ihr könnt mit unseren Liedvorschlägen euer Repertoire erweitern.
          Holt euch Inspiration, welches Lied von welcher Klassenstufe gut zu
          singen ist und macht in eurer internen Liederliste einen vorläufigen
          Plan. Mit den 5 Tipps zum Singen kannst du auch deinem Kollegium die
          Vorbereitung leichter machen und ein kurzes Warm-Up stimmt euch bereits
          aufs Singen ein.
        </p>

        {/* Resource grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              title={resource.title}
              thumbnail={resource.thumbnail}
              type={resource.type}
              href={resource.href}
              isLoading={isLoading && resource.type === 'pdf'}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ResourcesSection;
