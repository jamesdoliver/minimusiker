'use client';

import { TipAccordionItem } from './TipAccordionItem';

// Hardcoded preparation tips for all teacher portals
const PREPARATION_TIPS = [
  {
    id: '1',
    title: 'Weniger ist mehr',
    content:
      'Achtet bei eurer Liedauswahl darauf, dass Textsicherheit und Sangesfreude nicht darunter leiden, dass das Lied mit dreiundzwölfzig Strophen daherkommt. Ihr kennt das bei Liedern wie „Die Affen rasen…" oder „Meine Oma fährt…" - die ersten Strophen klappen super und dann wird der Gesang immer vorsichtiger und leiser. Bei der Aufnahme können wir uns darauf verständigen, wieviele Strophen ihr singen wollt und auch richtig gut klappen.',
  },
  {
    id: '2',
    title: 'Vorbild',
    content:
      'Sei dir deiner Rolle als musikalisches Vorbild bewusst. Stehst du vor den Kindern und flüsterst den Liedtext mit, ist das im ersten Moment vielleicht gut gemeint, einige Kinder werden das aber zum Anlass nehmen, ebenfalls zu flüstern. Bei der Aufnahme können wir dich so platzieren, dass du hinter den Mikrofonen - aber den Kindern zugewandt - stehst. So hört man wenig von deinem Gesang auf der Aufnahme und du kannst mit großer Freude mitsingen.',
  },
  {
    id: '3',
    title: 'Song vs. Playback',
    content:
      'Übt die Songs zunächst ruhig in der Version mit Gesang. So lernen und verinnerlichen die Kinde den Text gut. Für die Aufnahme werden wir aber immer die Playbackversion verwenden, denn unser Gesang soll ja nun nicht mit über die Mikrofone aufgenommen werden. Wenn der Gesang aber plötzlich fehlt, werden Einsätze und Strophenanfänge umso wichtiger. Übt die daher besonders.',
  },
  {
    id: '4',
    title: 'Texthilfen',
    content:
      'Gerade für jüngere Kinder sind bildhafte Texthilfen ein echter Gamechanger. Das können kleine Illustrationen oder Piktogramme/Emojis (z.B. Hund/Katze) sein und schon ist klar, wie die erste Strophe beim „Lied über mich" beginnt. Du kannst auch mit Gesten oder Bewegungen eine Hilfestellung geben und beim Lied „Ich lieb den Frühling" in der zweiten Strophe ein „Eis schlecken" vormachen.',
  },
  {
    id: '5',
    title: 'Zusätzliches Material',
    content:
      'Wenn dich die musikalische Kreativität packt, findet du bei uns weiterführendes Material zu vielen Liedern, die den Einsatz von Boomwhackern, Glockenspielen oder eine Begleitung mit Bodypercussion erklären. Unsere Materialpakete und Songpakete sind hier schnelle Ideengeber für die Vorbereitung der Lieder in deinem Musikunterricht.',
  },
];

export function TipsSection() {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Tipps für die Vorbereitung
        </h2>

        {/* Full-width accordion */}
        <div className="space-y-0">
          {PREPARATION_TIPS.map((tip, index) => (
            <TipAccordionItem
              key={tip.id}
              title={tip.title}
              content={tip.content}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default TipsSection;
