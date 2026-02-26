import { Alert, Container, Image, Text, VStack } from "@chakra-ui/react"
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
      </VStack>
    </Container>
  )
}
