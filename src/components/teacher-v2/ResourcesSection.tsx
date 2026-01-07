'use client';

import { ResourceCard } from './ResourceCard';

interface Resource {
  id: string;
  title: string;
  thumbnail: string;
  type: 'pdf' | 'video';
  href: string;
}

interface ResourcesSectionProps {
  resources?: Resource[];
}

const defaultResources: Resource[] = [
  {
    id: '1',
    title: 'Liedvorschläge',
    thumbnail: '',
    type: 'pdf',
    href: '#',
  },
  {
    id: '2',
    title: 'Was singen wir?',
    thumbnail: '',
    type: 'pdf',
    href: '#',
  },
  {
    id: '3',
    title: 'Singen mit Kindern',
    thumbnail: '',
    type: 'pdf',
    href: '#',
  },
  {
    id: '4',
    title: 'Warm Up',
    thumbnail: '',
    type: 'video',
    href: '#',
  },
];

export function ResourcesSection({ resources = defaultResources }: ResourcesSectionProps) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Liedvorschläge & Material
        </h2>

        <p className="text-gray-600 leading-relaxed mb-8 max-w-3xl">
          Hier findest du hilfreiche Materialien zur Vorbereitung auf den
          Minimusikertag. Lade dir Liedvorschläge herunter oder schaue dir
          unser Warm-Up-Video an.
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
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ResourcesSection;
