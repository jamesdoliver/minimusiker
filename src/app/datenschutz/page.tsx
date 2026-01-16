import Link from 'next/link';

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-[#f8f7f4] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-heading text-4xl font-bold text-gray-900 mb-2">Datenschutzerklärung</h1>
        <p className="text-sm text-gray-500 mb-8">Letzte Fassung: 16. Januar 2026</p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          {/* Introduction */}
          <section>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Minimusiker betreibt diesen Shop und diese Website, einschließlich aller zugehörigen Informationen, Inhalte, Funktionen, Tools, Produkte und Services, um Ihnen als Kunde ein individuelles Einkaufserlebnis bereitzustellen (die „Services"). Minimusiker basiert auf Shopify, wodurch wir in der Lage sind, Ihnen die Services bereitzustellen. In dieser Datenschutzerklärung wird beschrieben, wie wir personenbezogene Daten erfassen, verwenden oder weitergeben, wenn Sie die Website besuchen, nutzen oder einen Kauf oder eine andere Transaktion unter Verwendung der Services tätigen oder anderweitig mit uns kommunizieren. Wenn es einen Konflikt zwischen unseren{' '}
                <Link href="/agb" className="text-pink-600 hover:text-pink-700 underline">
                  allgemeinen Geschäftsbedingungen
                </Link>
                {' '}und dieser Datenschutzerklärung gibt, hat diese Datenschutzerklärung Vorrang in Bezug auf die Erfassung, Verarbeitung und Weitergabe Ihrer personenbezogenen Daten.
              </p>
              <p>
                Lesen Sie sich diese Datenschutzerklärung bitte sorgfältig durch. Indem Sie einen der Services nutzen und darauf zugreifen, bestätigen Sie, dass Sie diese Datenschutzerklärung gelesen haben und mit der Erfassung, Verwendung und Weitergabe Ihrer Daten, wie in dieser Datenschutzerklärung beschrieben, einverstanden sind.
              </p>
            </div>
          </section>

          {/* What data do we collect */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Welche personenbezogenen Daten erfassen oder verarbeiten wir?</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Wenn wir den Begriff „personenbezogene Daten" verwenden, beziehen wir uns auf Informationen, die Sie oder eine andere Person identifizieren oder unmittelbar mit Ihnen in Verbindung gebracht werden können. Personenbezogene Daten umfassen keine Informationen, die anonym erfasst oder so anonymisiert wurden, dass eine Identifizierung oder eine Zuordnung zu Ihrer Person nicht möglich ist. Je nachdem, wie Sie mit den Services interagieren, wo Sie wohnen und wie es das geltende Recht erlaubt oder vorschreibt, können wir die folgenden Kategorien personenbezogener Daten erfassen oder verarbeiten, einschließlich der aus diesen personenbezogenen Daten gezogenen Rückschlüsse:
              </p>
              <ul className="space-y-2 ml-4">
                <li>
                  <span className="font-medium text-gray-700">Kontaktdaten</span> einschließlich Name, Postanschrift, Rechnungsadresse, Lieferadresse, Telefonnummer und E-Mail-Adresse.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Finanzdaten</span> einschließlich Kredit-, Debitkarten- und Finanzkontonummern, Zahlungskarteninformationen, Finanzkontoinformationen, Transaktionsdetails, Zahlungsart, Zahlungsbestätigung und andere Zahlungsdetails.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Kontoinformationen</span> darunter Benutzername, Passwort, Sicherheitsfragen, Konfigurationen und Einstellungen.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Transaktionsinformationen</span> einschließlich der Artikel, die Sie sich ansehen, in den Warenkorb legen, auf die Wunschliste setzen oder kaufen, zurückgeben, umtauschen oder stornieren, sowie Ihre vergangenen Transaktionen.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Kommunikation mit uns</span> einschließlich der Informationen, die Sie bei der Kommunikation mit uns angeben, beispielsweise wenn Sie eine Anfrage an den Kundensupport senden.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Geräteinformationen</span> einschließlich Informationen über Gerät, Browser oder Netzwerkverbindung, IP-Adresse und andere eindeutige Identifikatoren.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Nutzungsinformationen</span> einschließlich Informationen über Ihre Interaktion mit den Services, auch darüber, wie und wann Sie mit den Services interagieren oder sie durchsuchen.
                </li>
              </ul>
            </div>
          </section>

          {/* Sources of personal data */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Quellen von personenbezogenen Daten</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>Wir können personenbezogene Daten über die folgenden Quellen erfassen:</p>
              <ul className="space-y-2 ml-4">
                <li>
                  <span className="font-medium text-gray-700">Direkt von Ihnen</span> – Wir erfassen die Daten unter anderem, wenn Sie ein Konto erstellen, die Services aufrufen oder nutzen, mit uns kommunizieren oder uns anderweitig Ihre personenbezogenen Daten zur Verfügung stellen.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Automatisch über die Services</span> – Wir erfassen die Daten unter anderem von Ihrem Gerät oder wenn Sie unsere Produkte oder Services nutzen oder unsere Website besuchen sowie über die Verwendung von Cookies und ähnlichen Technologien.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Von unseren Dienstanbietern</span> – Wir erfassen die Daten unter anderem, wenn wir die Dienstanbieter beauftragen, bestimmte Technologien zu aktivieren, und wenn sie Ihre personenbezogenen Daten in unserem Auftrag erfassen oder verarbeiten.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Von unseren Partnern und anderen Drittanbietern</span>
                </li>
              </ul>
            </div>
          </section>

          {/* How do we use your data */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Wie verwenden wir Ihre personenbezogene Daten?</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>Je nachdem, wie Sie mit uns interagieren oder welche der Services Sie nutzen, können wir personenbezogene Daten für die folgenden Zwecke verwenden:</p>
              <ul className="space-y-3 ml-4">
                <li>
                  <span className="font-medium text-gray-700">Bereitstellung, Anpassung und Verbesserung der Services.</span> Wir verwenden Ihre personenbezogenen Daten, um Ihnen die Services bereitzustellen. Das umfasst unter anderem die Erfüllung unseres Vertrags mit Ihnen, die Verarbeitung Ihrer Zahlungen, die Ausführung Ihrer Bestellungen, die Speicherung Ihrer Konfigurationen und der Artikel, für die Sie sich interessieren, die Versendung von Benachrichtigungen im Zusammenhang mit Ihrem Konto, die Erstellung, Pflege und sonstige Verwaltung Ihres Kontos, die Organisation des Versands, die Erleichterung von Rückgaben und Umtausch, die Möglichkeit, dass Sie Bewertungen abgeben, und die Schaffung eines individuellen Einkaufserlebnisses für Sie, indem wir Ihnen beispielsweise Produkte empfehlen, die sich an Ihren Käufen orientieren. Dazu kann auch die Verwendung Ihrer personenbezogenen Daten gehören, um die Services besser anzupassen und zu verbessern.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Marketing und Werbung.</span> Wir verwenden Ihre personenbezogenen Daten für Marketing- und Werbezwecke, um beispielsweise Marketing- und Werbemitteilungen per E-Mail, SMS oder Post zu versenden und Ihnen online Werbung für Produkte oder Leistungen für die Services oder andere Websites anzuzeigen, auch auf der Grundlage von Artikeln, die Sie zuvor gekauft oder in Ihren Warenkorb gelegt haben, sowie anderen Aktivitäten in Bezug auf die Services.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Sicherheit und Betrugsprävention.</span> Wir verwenden Ihre personenbezogenen Daten, um Ihr Konto zu authentifizieren, ein sicheres Zahlungs- und Einkaufserlebnis bereitzustellen, mögliche betrügerische, illegale, unsichere oder böswillige Aktivitäten aufzudecken, zu untersuchen oder Maßnahmen zu ergreifen, die öffentliche Sicherheit zu schützen und für die Sicherheit unserer Services zu sorgen. Wenn Sie sich entscheiden, die Services zu nutzen und ein Konto zu registrieren, sind Sie dafür verantwortlich, Ihre Kontoanmeldedaten zu schützen. Wir empfehlen dringend, dass Sie Ihren Benutzernamen, Ihr Passwort oder andere Zugangsdaten nicht an andere Personen weiterzugeben.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Kommunikation mit Ihnen.</span> Wir verwenden Ihre personenbezogenen Daten, um Ihnen Kundensupport und effektive Services bereitzustellen, zeitnah auf Ihre Anfragen zu reagieren und unsere Geschäftsbeziehung mit Ihnen aufrechtzuerhalten.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Rechtliche Gründe.</span> Wir verwenden Ihre personenbezogenen Daten, um geltendes Recht einzuhalten oder auf rechtmäßige Verfahrensschritte zu reagieren, einschließlich Anfragen von Strafverfolgungs- oder Aufsichtsbehörden, um zivilrechtliche Ermittlungen, potenzielle oder konkrete Rechtsstreitigkeiten oder andere kontradiktorische Verfahren zu untersuchen oder daran teilzunehmen und um potenzielle Verstöße gegen unsere Bedingungen oder Richtlinien zu untersuchen oder die Bedingungen und Richtlinien durchzusetzen.
                </li>
              </ul>
            </div>
          </section>

          {/* How do we share data */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Wie geben wir personenbezogene Daten weiter?</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>Unter bestimmten Umständen können wir Ihre personenbezogenen Daten für legitime Zwecke gemäß dieser Datenschutzerklärung an Dritte weitergeben. Solche Umstände können Folgendes umfassen:</p>
              <ul className="space-y-3 ml-4">
                <li>
                  Bei Shopify sind dies Anbieter und andere Dritte, die in unserem Auftrag Services erbringen (z.&nbsp;B. IT-Management, Zahlungsabwicklung, Datenanalyse, Kundensupport, Cloud-Speicher, Fulfillment und Versand).
                </li>
                <li>
                  Wir geben personenbezogene Daten an Geschäfts- und Marketingpartner weiter, die für Sie Marketingservices erbringen und Ihnen Werbung anzeigen. Wir nutzen Shopify beispielsweise, um personalisierte Werbung mit Services von Drittanbietern zu unterstützen, die auf Ihren Online-Aktivitäten bei verschiedenen Händlern und Websites basieren. Unsere Geschäfts- und Marketingpartner verwenden Ihre Daten gemäß ihren eigenen Datenschutzerklärungen. Je nach Ihrem Wohnort haben Sie möglicherweise das Recht, uns anzuweisen, keine Informationen über Sie weiterzugeben, um Ihnen gezielte Werbung und Marketing auf der Grundlage Ihrer Online-Aktivitäten bei verschiedenen Händlern und Websites anzuzeigen.
                </li>
                <li>
                  Wenn Sie uns auffordern oder anderweitig Ihre Zustimmung geben, bestimmte Informationen an Dritte weiterzugeben, beispielsweise um Ihnen Produkte zu liefern, oder wenn Sie Social-Media-Widgets oder Login-Integrationen nutzen.
                </li>
                <li>
                  Wir geben personenbezogene Daten an unsere Affiliates oder anderweitig innerhalb unserer Unternehmensgruppe weiter.
                </li>
                <li>
                  Im Zusammenhang mit einer geschäftlichen Transaktion wie einer Fusion oder Insolvenz, zur Einhaltung geltender gesetzlicher Verpflichtungen (einschließlich der Reaktion auf Vorladungen, Durchsuchungsbeschlüsse und ähnliche Anfragen), zur Durchsetzung geltender Servicebedingungen oder Richtlinien und zum Schutz oder zur Verteidigung der Services, unserer Rechte und der Rechte unserer Nutzer oder anderer.
                </li>
              </ul>
            </div>
          </section>

          {/* Relationship with Shopify */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Beziehung mit Shopify</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Die Services werden von Shopify gehostet, wobei Shopify personenbezogene Daten über Ihren Zugriff auf die Services und deren Nutzung erfasst und verarbeitet, um Ihnen die Services bereitzustellen und zu verbessern. Daten, die Sie an die Services übermitteln, werden an Shopify sowie an Dritte weitergegeben, die sich möglicherweise in anderen Ländern als dem Land Ihres Wohnsitzes befinden, um die Services für Sie bereitzustellen und zu verbessern. Um unser Geschäft zu schützen, zu erweitern und zu verbessern, verwenden wir außerdem bestimmte erweiterte Shopify-Funktionen, die Daten und Informationen aus Ihren Interaktionen mit unserem Shop, mit anderen Händlern und mit Shopify einbeziehen. Um diese erweiterten Funktionen bereitzustellen, kann Shopify personenbezogene Daten verwenden, die über Ihre Interaktionen mit unserem Shop, anderen Händlern und Shopify erfasst wurden. Unter diesen Umständen ist Shopify für die Verarbeitung Ihrer personenbezogenen Daten verantwortlich, einschließlich der Beantwortung Ihrer Anfragen zur Ausübung Ihrer Rechte bezüglich der Verwendung Ihrer personenbezogenen Daten für diese Zwecke.
              </p>
              <p>
                Weitere Informationen darüber, wie Shopify Ihre personenbezogenen Daten verwendet und welche Rechte Sie haben, finden Sie in der{' '}
                <a
                  href="https://www.shopify.com/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700 underline"
                >
                  Shopify Datenschutzrichtlinie für Verbraucher
                </a>
                . Abhängig davon, wo Sie Ihren Wohnsitz haben, können Sie{' '}
                <a
                  href="https://privacy.shopify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700 underline"
                >
                  hier bestimmte Rechte in Bezug auf Ihre personenbezogenen Daten ausüben
                </a>
                .
              </p>
            </div>
          </section>

          {/* Third party websites */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Websites und Links von Drittanbietern</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Die Services können Links zu Websites oder anderen Online-Plattformen bereitstellen, die von Drittanbietern betrieben werden. Wenn Sie Links zu Websites folgen, die keine Affiliate-Websites sind oder nicht von uns kontrolliert werden, sollten Sie deren Datenschutz- und Sicherheitsrichtlinien sowie sonstige Geschäftsbedingungen überprüfen. Wir übernehmen keine Garantie und sind nicht verantwortlich für den Datenschutz oder die Sicherheit solcher Websites, einschließlich der Genauigkeit, Vollständigkeit oder Zuverlässigkeit der auf diesen Websites befindlichen Informationen. Informationen, die Sie an öffentlichen oder halböffentlichen Orten bereitstellen, einschließlich der Informationen, die Sie auf Social Networking-Plattformen von Drittanbietern weitergeben, können auch von anderen Nutzern der Services und/oder Nutzern dieser Drittanbieter-Plattformen eingesehen werden, ohne Einschränkungen in Bezug auf deren Nutzung durch uns oder durch einen Drittanbieter. Die Aufnahme solcher Links durch uns bedeutet nicht, dass wir die Inhalte dieser Plattformen oder deren Eigentümer oder Betreiber unterstützen, es sei denn, dies ist in den Services ausdrücklich erwähnt.
              </p>
            </div>
          </section>

          {/* Children's data */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Daten von Kindern</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Die Services sind nicht für die Nutzung durch Kinder gedacht, und wir erfassen wissentlich keine personenbezogenen Daten von Kindern, die in Ihrem Land noch nicht volljährig sind. Wenn Sie die Eltern oder der Vormund eines Kindes sind, das uns seine personenbezogenen Daten zur Verfügung gestellt hat, können Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen, um die Löschung dieser Daten zu verlangen. Zum Zeitpunkt des Inkrafttretens dieser Datenschutzerklärung haben wir keine Kenntnis davon, dass wir personenbezogene Daten von Personen unter 16&nbsp;Jahren „weitergeben" oder „verkaufen" (gemäß der Definition dieser Begriffe im geltenden Recht).
              </p>
            </div>
          </section>

          {/* Security and retention */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Sicherheit und Aufbewahrung Ihrer Daten</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Bitte beachten Sie, dass keine Sicherheitsmaßnahmen perfekt oder undurchdringlich sind, und wir daher keine „perfekte Sicherheit" garantieren können. Zudem können auch Informationen, die Sie uns senden, während der Übertragung Risiken ausgesetzt sein. Wir empfehlen Ihnen, bei der Übermittlung sensibler oder vertraulicher Informationen an uns keine unsicheren Kanäle zu verwenden.
              </p>
              <p>
                Wie lange wir Ihre personenbezogenen Daten aufbewahren, hängt von verschiedenen Faktoren ab. Dazu gehören beispielsweise die Frage, ob wir die Daten benötigen, um Ihr Konto zu verwalten, Ihnen Services zur Verfügung zu stellen, rechtlichen Verpflichtungen nachzukommen, Streitigkeiten beizulegen oder andere geltende Verträge und Richtlinien durchzusetzen.
              </p>
            </div>
          </section>

          {/* Your rights */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Ihre Rechte und Möglichkeiten</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Je nachdem, wo sich Ihr Wohnsitz befindet, haben Sie möglicherweise einige oder alle der unten aufgeführten Rechte in Bezug auf Ihre personenbezogene Daten. Diese Rechte sind jedoch nicht absolut, gelten möglicherweise nur unter bestimmten Umständen, und in bestimmten Fällen können wir Ihre Anfrage im gesetzlich zulässigen Rahmen ablehnen.
              </p>
              <ul className="space-y-2 ml-4">
                <li>
                  <span className="font-medium text-gray-700">Recht auf Zugang/Auskunft.</span> Sie haben möglicherweise das Recht, Einsicht in die personenbezogenen Daten zu verlangen, die wir über Sie gespeichert haben.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Recht auf Löschung.</span> Sie haben möglicherweise das Recht, von uns die Löschung der über Sie gespeicherten personenbezogenen Daten zu verlangen.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Recht auf Berichtigung.</span> Sie haben möglicherweise das Recht, von uns die Berichtigung fehlerhafter personenbezogenen Daten zu verlangen, die wir über Sie gespeichert haben.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Recht auf Datenübertragbarkeit.</span> Sie haben möglicherweise das Recht, eine Kopie der personenbezogenen Daten, die wir über Sie gespeichert haben, zu erhalten und zu verlangen, dass wir sie unter bestimmten Umständen und mit bestimmten Ausnahmen an einen Dritten weitergeben.
                </li>
                <li>
                  <span className="font-medium text-gray-700">Verwaltung von Kommunikationseinstellungen.</span> Wir können Ihnen Werbe-E-Mails zusenden. Sie können dem Erhalt dieser E-Mails jederzeit widersprechen, indem Sie die Option zum Abbestellen nutzen, die in unseren E-Mails an Sie enthalten ist. Wenn Sie sich dagegen entscheiden, können wir Ihnen weiterhin nicht werbliche E-Mails schicken, z.&nbsp;B. über Ihr Konto oder über Bestellungen, die Sie getätigt haben.
                </li>
              </ul>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-700 mb-2">Zusätzliche Rechte für Einwohner des Vereinigten Königreichs oder des Europäischen Wirtschaftsraums:</p>
                <ul className="space-y-2 ml-4">
                  <li>
                    <span className="font-medium text-gray-700">Recht auf Widerspruch und Recht auf Einschränkung der Verarbeitung.</span> Sie haben möglicherweise das Recht, von uns zu verlangen, dass wir die Verarbeitung personenbezogener Daten für bestimmte Zwecke einstellen oder einschränken.
                  </li>
                  <li>
                    <span className="font-medium text-gray-700">Widerruf der Einwilligung.</span> Sofern wir uns auf eine Einwilligung zur Verarbeitung Ihrer personenbezogenen Daten stützen, haben Sie das Recht, diese Einwilligung zu widerrufen. Wenn Sie Ihre Einwilligung widerrufen, hat dies keinen Einfluss auf die Rechtmäßigkeit der Verarbeitung, die auf Ihrer Einwilligung vor dem Widerruf beruht.
                  </li>
                </ul>
              </div>

              <p>
                Sie können diese Rechte ausüben, wenn dies in den Services entsprechend angegeben ist, oder indem Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen. Mehr Informationen darüber, wie Shopify Ihre personenbezogenen Daten verwendet und welche Rechte Sie haben, einschließlich der Rechte in Bezug auf die von Shopify verarbeiteten Daten, finden Sie unter{' '}
                <a
                  href="https://privacy.shopify.com/en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700 underline"
                >
                  https://privacy.shopify.com/en
                </a>
                .
              </p>
              <p>
                Durch die Ausübung dieser Rechte entstehen Ihnen keinerlei Nachteile. Sofern dies nach geltendem Recht zulässig oder erforderlich ist, müssen wir möglicherweise Ihre Identität überprüfen, bevor wir Ihre Anfragen verarbeiten können. In Übereinstimmung mit geltenden Gesetzen können Sie einen Bevollmächtigten benennen, der in Ihrem Namen Anfragen zur Ausübung Ihrer Rechte stellt. Bevor wir eine solche Anfrage von einem Vertreter annehmen, verlangen wir von diesem den Nachweis, dass Sie ihn bevollmächtigt haben, in Ihrem Namen zu handeln. Dabei kann es erforderlich sein, dass Sie Ihre Identität direkt uns gegenüber bestätigen müssen. Wir werden Ihre Anfrage im Rahmen des geltenden Rechts zügig beantworten.
              </p>
            </div>
          </section>

          {/* Complaints */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Beschwerden</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Wenn Sie Beschwerden darüber haben, wie wir Ihre personenbezogenen Daten verarbeiten, wenden Sie sich bitte über die unten angegebenen Kontaktdaten an uns. Je nachdem, wo sich Ihr Wohnsitz befindet, haben Sie das Recht, gegen unsere Entscheidung Einspruch zu erheben, indem Sie sich unter den unten angegebenen Kontaktdaten an uns wenden oder Ihre Beschwerde bei der zuständigen Datenschutzbehörde einreichen. Für den Europäischen Wirtschaftsraum gibt es eine{' '}
                <a
                  href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700 underline"
                >
                  Liste der zuständigen Datenschutzaufsichtsbehörden
                </a>
                .
              </p>
            </div>
          </section>

          {/* International transfers */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Internationale Übertragungen</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Beachten Sie, dass wir Ihre personenbezogenen Daten möglicherweise außerhalb des Landes, in dem sich Ihr Wohnsitz befindet, übertragen, speichern und verarbeiten.
              </p>
              <p>
                Wenn wir Ihre personenbezogenen Daten außerhalb des Europäischen Wirtschaftsraums oder des Vereinigten Königreichs übermitteln, stützen wir uns auf anerkannte Übermittlungsmechanismen wie die Standardvertragsklauseln der Europäischen Kommission oder gleichwertige Verträge, die von der jeweils zuständigen Behörde des Vereinigten Königreichs herausgegeben werden, es sei denn, die Datenübermittlung erfolgt in ein Land, das nachweislich ein angemessenes Schutzniveau bietet.
              </p>
            </div>
          </section>

          {/* Changes to policy */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Änderungen an dieser Datenschutzerklärung</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren, um beispielsweise Änderungen unserer Verfahrensweisen zu berücksichtigen, oder aus anderen betrieblichen, rechtlichen oder regulatorischen Gründen. Wir veröffentlichen die überarbeitete Datenschutzerklärung auf dieser Website, passen das Datum der „Letzten Fassung" entsprechend an und machen die nach geltendem Recht erforderliche Mitteilung.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Kontakt</h2>
            <div className="text-gray-600 text-sm space-y-3 leading-relaxed">
              <p>
                Sollten Sie Fragen zu unseren Datenschutzverfahren oder dieser Datenschutzerklärung haben, oder wenn Sie eines der Ihnen zustehenden Rechte ausüben möchten, wenden Sie sich bitte per E-Mail an{' '}
                <a href="mailto:shopify@guesstimate.de" className="text-pink-600 hover:text-pink-700">
                  shopify@guesstimate.de
                </a>
                {' '}oder per Post an uns.
              </p>
              <p>
                Im Sinne der geltenden Datenschutzgesetze sind wir der Datenverantwortliche für Ihre personenbezogenen Daten.
              </p>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-700">Minimusiker</p>
                <p className="mt-2">Willdenowstr. 4, 13353 Berlin</p>
                <p className="mt-2">
                  <a href="mailto:shopify@guesstimate.de" className="text-pink-600 hover:text-pink-700">
                    shopify@guesstimate.de
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
