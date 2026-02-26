import {
  Box,
  Container,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Link as RouterLink, createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { ErrorState, SessionExpiredState } from "@/components/Common"
import { OnboardingModal } from "@/components/Onboarding/OnboardingModal"
import {
  HelpPanel,
  QuizGenerationPanel,
  QuizReviewPanel,
} from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { useUserQuizzes } from "@/hooks/api"
import { useAuth } from "@/hooks/auth"
import { useCustomToast, useOnboarding } from "@/hooks/common"
import { isAuthError } from "@/lib/utils/errors"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const { user: currentUser } = useAuth()
  const { showErrorToast } = useCustomToast()
  const { t } = useTranslation(["dashboard", "quiz"])
  const {
    currentStep,
    isOpen,
    nextStep,
    previousStep,
    markOnboardingCompleted,
  } = useOnboarding()

  const { data: quizzes, isLoading, error } = useUserQuizzes()

  if (error) {
    if (isAuthError(error)) {
      return <SessionExpiredState />
    }

    showErrorToast(t("errors.loadFailed"))
    return (
      <Container maxW="6xl" py={8}>
        <ErrorState
          title={t("errors.title")}
          message={t("errors.message")}
          showRetry={false}
        />
      </Container>
    )
  }

  return (
    <>
      <Container maxW="6xl" py={8} data-testid="dashboard-container">
        <VStack gap={6} align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <Box>
              <Text fontSize="3xl" fontWeight="bold">
                {t("greeting", { name: currentUser?.name })} 👋🏼
              </Text>
              <Text color="gray.600">{t("welcome")}</Text>
            </Box>
            <Button asChild>
              <RouterLink to="/create-quiz">
                {t("quiz:actions.createQuiz")}
              </RouterLink>
            </Button>
          </HStack>
          {/* Dashboard Panels */}
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3 }}
            gap={6}
            data-testid="dashboard-grid"
          >
            <QuizReviewPanel quizzes={quizzes || []} isLoading={isLoading} />
            <QuizGenerationPanel
              quizzes={quizzes || []}
              isLoading={isLoading}
            />
            <HelpPanel />
          </SimpleGrid>
        </VStack>
      </Container>

      <OnboardingModal
        isOpen={isOpen}
        currentStep={currentStep}
        onNext={nextStep}
        onPrevious={previousStep}
        onComplete={markOnboardingCompleted}
      />
    </>
  )
}
