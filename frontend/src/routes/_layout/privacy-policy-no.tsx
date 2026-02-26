import { Box, Container, Heading, List, Text, VStack } from "@chakra-ui/react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { UI_LANGUAGES } from "@/i18n"

export const Route = createFileRoute("/_layout/privacy-policy-no")({
  component: PrivacyPolicyNo,
})

function PrivacyPolicyNo() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (i18n.language === UI_LANGUAGES.ENGLISH) {
      navigate({ to: "/privacy-policy", replace: true })
    }
  }, [i18n.language, navigate])

  return (
    <Container maxW="4xl" py={8}>
      <VStack gap={8} align="stretch">
        <Heading size="2xl" textAlign="center">
          Personvernerklæring
        </Heading>

        <Text fontSize="sm" color="gray.600" textAlign="center">
          Sist oppdatert: 22.01.2026
        </Text>

        <Box>
          <Heading size="lg" mb={4}>
            1. Introduksjon
          </Heading>
          <Text mb={4}>
            QuizCrafter er en applikasjon utviklet ved UiT Norges arktiske
            universitet for å hjelpe forelesere og kurskoordinatorer med å
            generere quizer basert på kursinnhold fra Canvas LMS. Applikasjonen
            forenkler opprettelsen av spørsmålsbanker for quizer og andre
            vurderinger.
          </Text>
          <Text mb={4}>
            For å kontinuerlig forbedre kvaliteten på KI-genererte spørsmål,
            beholdes anonymiserte quiz- og spørsmålsdata for analyse. Dette
            inkluderer sporing av godkjenning, avvisning og redigeringsmønstre
            for spørsmål. Disse dataene kan også brukes til fremtidig akademisk
            forskning.
          </Text>
          <Text>Denne personvernerklæringen forklarer:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>Hvilke data vi samler inn</List.Item>
              <List.Item>Hvordan vi bruker og lagrer dem</List.Item>
              <List.Item>Hvordan vi beskytter dataene dine</List.Item>
              <List.Item>Dine rettigheter under GDPR</List.Item>
            </List.Root>
          </Box>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            2. Data vi samler inn
          </Heading>
          <Heading size="md" mb={4}>
            2.1 Brukerdata
          </Heading>
          <Text mb={4}>
            Samles inn når du logger inn med Canvas LMS-kontoen din via OAuth2:
          </Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>
                Personlige identifikatorer: Navn, Canvas LMS bruker-ID
                (canvas_id)
              </List.Item>
              <List.Item>
                Autentiseringsdata: Krypterte Canvas OAuth-tilgangstokener og
                oppdateringstokener, tokenutløp
              </List.Item>
              <List.Item>
                Brukspreferanser: Status for gjennomført introduksjon
              </List.Item>
              <List.Item>
                Systemmetadata: Tidsstempler for kontoopprettelse og
                oppdateringer
              </List.Item>
            </List.Root>
          </Box>
          <Heading size="md" mb={4}>
            2.2 Quiz-data
          </Heading>
          <Text mb={4}>Samles inn når du oppretter quizer:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>
                Kursdata: Canvas kurs-ID og navn, valgte moduler
              </List.Item>
              <List.Item>
                Innholdsdata: Ekstrahert kursinnhold for RAG-målinger
                (retrieval-augmented generation)
              </List.Item>
              <List.Item>
                Quiz-innstillinger: Antall spørsmål, AI-modellparametere, språk,
                tone
              </List.Item>
              <List.Item>
                Prosesseringsdata: Status, feilsporing, tidsstempler for
                innholdsekstraksjon og eksport
              </List.Item>
            </List.Root>
          </Box>
          <Heading size="md" mb={4}>
            2.3 Spørsmålsdata
          </Heading>
          <Text mb={4}>Genereres under quiz-opprettelse:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>
                Spørsmålsinnhold: Type, tekst, alternativer, riktige svar,
                forklaringer, vanskelighetsgrad, tagger
              </List.Item>
              <List.Item>
                Godkjenningsarbeidsflyt: Godkjenningsstatus, tidsstempler
              </List.Item>
              <List.Item>
                Redigeringshistorikk: Komplett revisjonslogg over endringer
              </List.Item>
              <List.Item>
                Integrasjonsdata: Canvas quiz-element-ID etter eksport
              </List.Item>
            </List.Root>
          </Box>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            3. Hvordan vi bruker dataene dine
          </Heading>
          <Text mb={4}>Dataene dine brukes til:</Text>
          <Box pl={6} mb={4}>
            <List.Root as="ol">
              <List.Item>
                Å tilby kjernefunksjonalitet: Generere quizer og eksportere dem
                til Canvas
              </List.Item>
              <List.Item>
                Å forbedre applikasjonen: Analysere anonymiserte quiz-/
                spørsmålsdata for å forbedre AI-spørsmålsgenerering
              </List.Item>
              <List.Item>
                Kvalitetsforskning: Måle og validere AI-generert innhold mot
                tilbakemeldinger fra lærere for å forbedre spørsmålskvaliteten
              </List.Item>
              <List.Item>
                Sikkerhet og feilsøking: Vedlikeholde sikre OAuth-tokener og
                diagnostisere tekniske problemer
              </List.Item>
            </List.Root>
          </Box>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            4. Retningslinjer for datalagring
          </Heading>
          <Text mb={4}>Vi opererer med en selektiv datalagringmodell:</Text>
          <Text mb={4}>Når du sletter kontoen din:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>
                Slettes umiddelbart: Alle personlige identifikatorer (navn,
                Canvas-ID), OAuth-tokener, preferanser og direkte
                bruker-til-quiz-tilknytninger.
              </List.Item>
              <List.Item>
                Bevares (anonymisert): Quiz-data, ekstrahert kursinnhold,
                genererte spørsmål og redigeringshistorikk for forskningsformål.
              </List.Item>
            </List.Root>
          </Box>
          <Text mb={4}>Oppbevaringsperioder:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>
                Persondata: Slettes umiddelbart ved forespørsel/kontosletting
              </List.Item>
              <List.Item>
                Anonymiserte quiz-/spørsmålsdata: Oppbevares i 1 år for
                forskning og systemforbedring
              </List.Item>
            </List.Root>
          </Box>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            5. Rettslig grunnlag for behandling
          </Heading>
          <Text mb={4}>
            Samtykke: Autentisering via Canvas LMS for å få tilgang til og
            behandle kursdataene dine
          </Text>
          <Text>
            Berettiget interesse: Oppbevaring av anonymiserte data for akademisk
            forskning og systemforbedring
          </Text>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            6. Beskyttelsestiltak for data
          </Heading>
          <Text mb={4}>Vi implementerer innebygd personvern:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>
                "Encryption at rest": OAuth-tokener er kryptert med en
                applikasjonshemmelig nøkkel
              </List.Item>
              <List.Item>
                Anonymisering: Alle personlige identifikatorer fjernes ved
                kontosletting
              </List.Item>
              <List.Item>
                Myk sletting: Anonymiserte data oppbevares uten å være
                tilgjengelige i vanlige brukervisninger
              </List.Item>
              <List.Item>
                Tilgangskontroll: Kun autoriserte forskere har tilgang til
                anonymiserte datasett
              </List.Item>
              <List.Item>
                Revisjonslogger: Redigeringshistorikk vedlikeholdes for
                transparens og forskningsvaliditet
              </List.Item>
            </List.Root>
          </Box>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            7. Dine rettigheter under GDPR
          </Heading>
          <Text mb={4}>Du har rett til å:</Text>
          <Box pl={6} mb={4}>
            <List.Root>
              <List.Item>Få tilgang til dine persondata</List.Item>
              <List.Item>Rette unøyaktige data</List.Item>
              <List.Item>
                Slette kontoen din og alle tilknyttede persondata
              </List.Item>
              <List.Item>
                Protestere mot behandling for ikke-essensielle formål
              </List.Item>
            </List.Root>
          </Box>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            8. Deling av data
          </Heading>
          <Text mb={4}>
            Vi selger eller deler ikke dine persondata med tredjeparter for
            markedsføring. Anonymiserte datasett kan deles med akademiske
            samarbeidspartnere for forskningsformål.
          </Text>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            9. Endringer i denne erklæringen
          </Heading>
          <Text mb={4}>
            Vi gjennomgår denne ved skjemaendringer. Oppdateringer vil bli
            kommunisert gjennom denne applikasjonen.
          </Text>
        </Box>

        <Box>
          <Heading size="lg" mb={4}>
            10. Kontaktinformasjon
          </Heading>
          <Text>
            Hvis du har spørsmål om denne personvernerklæringen, vennligst
            kontakt oss på: Marius Solaas, marius.r.solaas@uit.no
          </Text>
        </Box>
      </VStack>
    </Container>
  )
}
