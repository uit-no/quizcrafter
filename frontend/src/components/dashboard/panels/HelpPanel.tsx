import {
  Alert,
  Badge,
  Box,
  Card,
  HStack,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Trans, useTranslation } from "react-i18next"
import { LuExternalLink } from "react-icons/lu"

import { useLocalizedRoute } from "@/hooks/common"
import { LOCALIZED_ROUTES } from "@/lib/routes"

export function HelpPanel() {
  const { t } = useTranslation(["dashboard", "common"])
  const { getLocalizedRoute } = useLocalizedRoute()

  return (
    <Card.Root>
      <Card.Header>
        <Text fontSize="lg" fontWeight="semibold">
          {t("panels.help.title")}
        </Text>
        <Text fontSize="sm" color="gray.600">
          {t("panels.help.description")}
        </Text>
      </Card.Header>
      <Card.Body>
        <VStack gap={6} align="stretch">
          {/* About Section */}
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.700">
              {t("panels.help.about.title")}
            </Text>
            <Text fontSize="sm" color="gray.600" lineHeight="relaxed">
              {t("panels.help.about.content")}
            </Text>
          </Box>

          {/* How It Works Section */}
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={3} color="gray.700">
              {t("panels.help.howItWorks.title")}
            </Text>
            <VStack gap={2} align="stretch">
              <HStack gap={3}>
                <Badge variant="solid" colorScheme="blue" size="sm" minW="4">
                  1
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  {t("panels.help.howItWorks.step1")}
                </Text>
              </HStack>
              <HStack gap={3}>
                <Badge variant="solid" colorScheme="blue" size="sm" minW="4">
                  2
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  {t("panels.help.howItWorks.step2")}
                </Text>
              </HStack>
              <HStack gap={3}>
                <Badge variant="solid" colorScheme="blue" size="sm" minW="4">
                  3
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  {t("panels.help.howItWorks.step3")}
                </Text>
              </HStack>
              <HStack gap={3}>
                <Badge variant="solid" colorScheme="blue" size="sm" minW="4">
                  4
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  {t("panels.help.howItWorks.step4")}
                </Text>
              </HStack>
              <HStack gap={3}>
                <Badge variant="solid" colorScheme="blue" size="sm" minW="4">
                  5
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  {t("panels.help.howItWorks.step5")}
                </Text>
              </HStack>
            </VStack>
          </Box>

          {/* Helpful Links Section */}
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={3} color="gray.700">
              {t("panels.help.helpfulLinks.title")}
            </Text>
            <VStack gap={2} align="stretch">
              <Link
                href="https://uit.instructure.com"
                target="_blank"
                rel="noopener noreferrer"
                fontSize="sm"
                color="blue.600"
                _hover={{ textDecoration: "underline" }}
              >
                {t("panels.help.helpfulLinks.canvasUit")}
                <LuExternalLink />
              </Link>
              <Link
                href="mailto:marius.r.solaas@uit.no"
                fontSize="sm"
                color="blue.600"
                _hover={{ textDecoration: "underline" }}
              >
                {t("panels.help.helpfulLinks.contactDeveloper")}
              </Link>
              <Link
                href="https://github.com/solarmarius/quizcrafter"
                fontSize="sm"
                color="blue.600"
                _hover={{ textDecoration: "underline" }}
              >
                {t("panels.help.helpfulLinks.githubRepo")}
                <LuExternalLink />
              </Link>
              <Link
                href={getLocalizedRoute(LOCALIZED_ROUTES.questionTypes)}
                fontSize="sm"
                color="blue.600"
                _hover={{ textDecoration: "underline" }}
              >
                {t("panels.help.helpfulLinks.questionTypes")}
              </Link>
            </VStack>
          </Box>

          {/* Tips Section */}
          <Box
            p={3}
            bg="blue.50"
            borderRadius="md"
            border="1px solid"
            borderColor="blue.200"
          >
            <Text fontSize="sm" fontWeight="semibold" color="blue.700" mb={2}>
              {t("panels.help.tips.title")}
            </Text>
            <VStack gap={1} align="stretch">
              <Text fontSize="sm" color="blue.600">
                • {t("panels.help.tips.tip1")}
              </Text>
              <Text fontSize="sm" color="blue.600">
                • {t("panels.help.tips.tip2")}
              </Text>
              <Text fontSize="sm" color="blue.600">
                • {t("panels.help.tips.tip3")}
              </Text>
            </VStack>
          </Box>
          <Alert.Root status="info" variant="subtle" colorPalette="orange">
            <Alert.Content>
              <Alert.Description>
                <Trans
                  i18nKey="userSettings.privacyNotice"
                  ns="common"
                  components={{
                    privacyLink: (
                      <Link
                        href={getLocalizedRoute(LOCALIZED_ROUTES.privacyPolicy)}
                        color="blue.500"
                        textDecoration="underline"
                      />
                    ),
                  }}
                />
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
