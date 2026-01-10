/**
 * Types for Teacher Portal Weekly Videos feature
 */

import type { WeekInfo, VideoFolder } from '@/lib/utils/weekCalculator';

/**
 * Hardcoded intro video text for each folder.
 * All intros have title "Einleitungen" with custom descriptions.
 */
export const INTRO_CONFIG: Record<VideoFolder, { title: string; description: string }> = {
  Week8: {
    title: 'Einleitungen',
    description:
      'Lars und Till begleiten euch Schritt für Schritt bei der Vorbereitung auf euren Minimusikertag, damit dieser stressfrei und unvergesslich wird. Wöchentlich erhaltet ihr kurze Videos mit Tipps zur Liedauswahl, Warm-ups und zur Gestaltung des Aufnahmetags – einfach umsetzbar, auch ohne musikalische Vorkenntnisse. Alle Materialien wie Videos, MP3s und Checklisten findet ihr im bereitgestellten Tool, das euch flexibel Zugriff auf alle Inhalte ermöglicht. Jetzt könnt ihr eure Kinder auf den besonderen Tag einstimmen, z. B. mit dem Song „Hier spielt die Musik" und einer Runde Stopp-Tanzen. Wir freuen uns auf die gemeinsame musikalische Reise mit euch!',
  },
  Week7: {
    title: 'Einleitungen',
    description:
      'In der zweiten Vorbereitungswoche geht es um die Auswahl der Lieder für den Minimusikertag, die eure Einrichtung gut widerspiegeln. Ihr bekommt eine Liste mit passenden Liedern sowie Playbacks, die ihr zum Üben und für die Aufnahme nutzen dürft, da fremde Playbacks aus rechtlichen Gründen tabu sind. Nutzt für den kostenlosen Download den Gutschein aus eurer Anmeldung und stellt sicher, dass ihr alle gewünschten Songs in einer Bestellung zusammenfasst. Auch beim Ändern von Liedtexten gibt es urheberrechtliche Grenzen: Lars und Till erklären was erlaubt ist und begleiten euch weiterhin mit Tipps, damit der Minimusikertag ein voller Erfolg wird!',
  },
  Week6: {
    title: 'Einleitungen',
    description:
      'In dieser Vorbereitungswoche geht es um Warm-Ups und Rhythmusspiele, die Spaß machen und gleichzeitig die Stimme und das Rhythmusgefühl der Kinder trainieren. Ihr lernt drei einfache Warm-Ups („Brummen & Summen", „Lippenflattern" und das „Echo-Spiel") sowie Rhythmicals kennen, die spielerisch den gemeinsamen Groove fördern. Ein einfaches Rhythmical beginnt mit einem Grundrhythmus und kann schrittweise durch Namen oder kurze Sätze erweitert werden. Das bekommt ihr hin. Teilt die Übungen mit euren Kolleg:innen, damit das ganze Team mitmachen kann, zum Beispiel in Morgenkreisen oder als kleine Bewegungspause.',
  },
  Week5: {
    title: 'Einleitungen',
    description:
      'In dieser Woche geht es um folgende Themen: Erstens, die Liedbegleitung kann rhythmisch (z. B. mit Bodypercussion oder kleinen Percussion-Instrumenten) oder harmonisch (z. B. mit Gitarre oder Boomwhackern) erfolgen, wobei eine einfache und effektive Umsetzung empfohlen wird. Zweitens, für das Singen gibt es hilfreiche Tipps, um Kinder bei Textsicherheit, Tonhöhe, Rhythmus und Lautstärke zu unterstützen. Drittens, um die eigene Stimme zu schonen, helfen Maßnahmen wie ausreichend trinken, richtiges Aufwärmen, bewusstes Sprechen und Vermeidung von Stimmüberlastung. Viertens, nun solltet ihr euch auf eine Liedauswahl festlegen und diese über das Online-Tool eintragen, um eine optimale musikalische Begleitung durch das Minimusiker-Team zu ermöglichen.',
  },
  Week4: {
    title: 'Einleitungen',
    description:
      'Vier Wochen vor dem Minimusikertag erhaltet ihr organisatorische Informationen und das Materialpaket per Post. Darin findet ihr die Elternflyer und ein Poster. Wir skizzieren den zeitlichen Ablauf des Tages und geben Tipps für die Tagesstruktur und das Drumherum. Weiterhin bekommt ihr die Möglichkeit, frühzeitig mit eurem Minimusiker oder eurer Minimusikerin in Kontakt zu treten, um individuelle Absprachen zu treffen. Dabei geht es unter anderem um die musikalische Begleitung und besondere Wünsche der Einrichtung.',
  },
  Week3: {
    title: 'Einleitungen',
    description:
      'Drei Wochen vor dem Minimusikertag sollten Eltern informiert werden, wofür die bereitgestellten Flyer und das Poster genutzt werden können. Wir erklären die Bestellungen der Produkte und wie Eltern darankommen. Außerdem zeigen wir jedes Produkt einmal in die Kamera. Die Bestellung läuft über den Link auf dem Flyer, mit verschiedenen Zahlungsoptionen, und die Produkte werden eine Woche nach dem Projekttag hergestellt und geliefert. Außerdem empfehlen wir, ab jetzt die Playbackversionen der Lieder zu nutzen, damit sich die Kinder nicht zu sehr auf vorhandene Gesangsstimmen verlassen.',
  },
  Week2: {
    title: 'Einleitungen',
    description:
      'Zwei Wochen vor dem Minimusikertag geht es um die finale Ablaufplanung und letzte Vorbereitungen. Die Ankunftszeit der Minimusiker:innen wird abgestimmt, ebenso wie die Räumlichkeiten und organisatorische Details wie Parkmöglichkeiten und Stromanschluss. Die Liedauswahl sollte jetzt feststehen, und falls Begleitung durch die Minimusiker:in gewünscht ist, sollten Noten oder Akkorde bereitliegen. Das Bestellportal für die Eltern wird freigeschaltet, sodass sie bereits jetzt Musikprodukte online kaufen können. Abschließend gibt es den Hinweis, Piktogramme zur Unterstützung beim Lernen der Lieder zu nutzen und das Logo für das CD-Booklet hochzuladen.',
  },
  Week1: {
    title: 'Einleitungen',
    description:
      'In einer Woche ist es soweit. Liedanfänge und Einzähler sollten gut geübt sein und Kinder sollten bei Playback-Vorspielen leise sein, da die Mikrofone früh aufnehmen. Nach dem Singen sollen sie „einfrieren", um den Ausklang sauber zu halten, und bei Fehlern kann nachträglich geschnitten werden. Ein Warm-Up mit einer fantasievollen U-Boot-Geschichte hilft, die Stimmen aufzulockern. Gut zu wissen: Eltern können noch bis eine Woche nach dem Minimusikertag bestellen, bevor die Produktion startet. Abschließend heißt es: tief durchatmen – alles ist vorbereitet!',
  },
  EventDay: {
    title: 'Einleitungen',
    description:
      'Nun ist es soweit – bleibt entspannt, wir begleiten euch! Falls etwas nicht klappt, sind spontane Anpassungen möglich, sei es die Tonart, das Tempo oder sogar die Liedauswahl. Nach dem Tag könnt ihr die Liederliste finalisieren, bevor alles in den Druck geht.',
  },
  OneWeekAfter: {
    title: 'Einleitungen',
    description:
      'Jetzt ist der Minimusikertag vorbei: Wir freuen uns über euer Feedback und eure Eindrücke! Falls Eltern noch nicht bestellt haben, jetzt ist die letzte Chance – eine Erinnerung folgt per E-Mail. Die Bestellungen werden nun verarbeitet und an eure Einrichtung geschickt, inklusive einer Übersicht zur Verteilung. Ein großes Dankeschön an euch – wir hoffen, dass ihr die verbindende Kraft der Musik gespürt habt!',
  },
};

export interface TeacherVideo {
  key: string; // R2 object key
  filename: string; // e.g., "Week8_Intro_1.mp4"
  url: string; // Signed URL (valid for 1 hour)
  title: string; // Parsed from filename or generated
  description: string; // Generated based on video type
  isIntro: boolean; // Whether this is the intro video
  order: number; // Display order (parsed from filename)
}

export interface VideoFolderResponse {
  success: boolean;
  folder: string;
  weekInfo: WeekInfo;
  videos: TeacherVideo[];
  error?: string;
}

/**
 * Parse video filename to extract metadata
 *
 * Filename format: FolderName_[Intro|Number]_Custom-Title-Here.mp4
 *
 * Examples:
 * - Week8_Intro_Willkommen-und-Uebersicht.mp4 → "Willkommen und Übersicht" (intro)
 * - Week8_2_Die-ersten-Schritte.mp4 → "Die ersten Schritte" (video 2)
 * - EventDay_Intro_Der-grosse-Tag.mp4 → "Der große Tag" (intro)
 * - Week8_3_Lieder-ueben.mp4 → "Lieder üben" (video 3)
 *
 * Fallback (old format):
 * - Week8_Intro_1.mp4 → auto-generated title
 * - Week8_Video_2.mp4 → auto-generated title
 */
export function parseVideoFilename(
  filename: string,
  folder: string
): {
  title: string;
  description: string;
  isIntro: boolean;
  order: number;
} {
  // Remove .mp4 extension
  const nameWithoutExt = filename.replace(/\.mp4$/i, '');

  // Split by underscore: [Folder, Type/Number, ...TitleParts]
  const parts = nameWithoutExt.split('_');

  // Determine if intro (second part is "Intro" case-insensitive)
  const isIntro = parts.length >= 2 && parts[1].toLowerCase() === 'intro';

  // Extract order number
  let order: number;
  if (isIntro) {
    order = 1; // Intro is always first
  } else if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    order = parseInt(parts[1], 10);
  } else {
    order = 99;
  }

  // For intro videos, use hardcoded config
  if (isIntro) {
    const introConfig = INTRO_CONFIG[folder as VideoFolder];
    if (introConfig) {
      return {
        title: introConfig.title,
        description: introConfig.description,
        isIntro: true,
        order: 1,
      };
    }
  }

  // For non-intro videos, extract title from filename or auto-generate
  let title: string;
  const folderLabel = getFolderLabel(folder);

  if (parts.length >= 3) {
    // Custom title: join remaining parts, convert hyphens to spaces, fix German chars
    const titleParts = parts.slice(2).join(' ');
    title = convertFilenameToTitle(titleParts);
  } else {
    // Fallback: auto-generate title
    title = `${folderLabel} - Video ${order}`;
  }

  // Generate description for non-intro videos
  const description = `Vorbereitungsvideo für ${folderLabel}`;

  return { title, description, isIntro, order };
}

/**
 * Convert filename-safe string to display title
 * - Hyphens become spaces
 * - German character replacements: ue→ü, ae→ä, oe→ö, ss→ß
 */
function convertFilenameToTitle(input: string): string {
  let title = input
    // Replace hyphens with spaces
    .replace(/-/g, ' ')
    // Trim extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  // German character conversions (only lowercase patterns in word context)
  // Be careful not to convert "ue" in "queen" - we check for common patterns
  title = title
    .replace(/\bue/gi, 'ü')
    .replace(/ue\b/gi, 'ü')
    .replace(/\bae/gi, 'ä')
    .replace(/ae\b/gi, 'ä')
    .replace(/\boe/gi, 'ö')
    .replace(/oe\b/gi, 'ö')
    .replace(/Ue/g, 'Ü')
    .replace(/Ae/g, 'Ä')
    .replace(/Oe/g, 'Ö');

  return title;
}


/**
 * Get German label for folder name
 */
function getFolderLabel(folder: string): string {
  if (folder.startsWith('Week')) {
    const weekNum = folder.replace('Week', '');
    return `Woche ${weekNum}`;
  }
  if (folder === 'EventDay') {
    return 'Eventtag';
  }
  if (folder === 'OneWeekAfter') {
    return 'Nach dem Event';
  }
  return folder;
}
