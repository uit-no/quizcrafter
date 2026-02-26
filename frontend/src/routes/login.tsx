import {
  Alert,
  AspectRatio,
  Box,
  Container,
  Image,
  Text,
  VStack,
} from "@chakra-ui/react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import CanvasLoginButton from "@/components/ui/canvas-button"
import { isLoggedIn } from "@/hooks/auth"
import Illustration from "/assets/images/test-illustration.svg"

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      error: typeof search.error === "string" ? search.error : undefined,
    }
  },
})

function Login() {
  const { t } = useTranslation("common")
  const { error } = Route.useSearch()

  return (
    <Container
      h="100vh"
      maxW="md"
      alignItems="stretch"
      justifyContent="center"
      gap={4}
      centerContent
    >
      <VStack width="100%">
        <Image src={Illustration} p={2} />

        {/* App Title/Logo */}
        <VStack mb={4}>
          <Text fontSize="2xl" fontWeight="bold" textAlign="center">
            {t("login.welcome")}
          </Text>
          <Text fontSize="sm" color="gray.600" textAlign="center">
            {t("login.description")}
          </Text>
        </VStack>

        {/* Error Display */}
        {error && (
          <Alert.Root status="error">
            <Alert.Indicator />
            <Alert.Title>
              {t("login.errorMessage", { error: decodeURIComponent(error) })}
            </Alert.Title>
          </Alert.Root>
        )}

        {/* Canvas Login */}
        <CanvasLoginButton />

        {/* Help Section */}
        <Box bg="gray.50" p={4} borderRadius="md" width="100%" mt={4}>
          <Text fontSize="sm" fontWeight="medium" mb={3}>
            {t("login.helpTitle")}
          </Text>
          <AspectRatio ratio={16 / 9} mb={3}>
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/zV6bP3IMZ9w?si=9L1scxQGRYqMuCP-"
              title={t("login.videoTitle")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              style={{
                borderRadius: "8px",
                border: "none",
              }}
            />
          </AspectRatio>
          <Text fontSize="xs" color="gray.600">
            {t("login.videoDescription")}
          </Text>
        </Box>
      </VStack>
    </Container>
  )
}
