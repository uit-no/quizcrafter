import { Box, Button, Card, HStack, Text, VStack } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { LuPlus } from "react-icons/lu"

import { type Quiz, QuizService } from "@/client"
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/Common"
import { ManualQuestionDialog } from "@/components/Questions/ManualQuestionDialog"
import { QuestionReview } from "@/components/Questions/QuestionReview"
import { QuestionStats } from "@/components/Questions/QuestionStats"
import { useAuth } from "@/hooks/auth"
import { useConditionalPolling } from "@/hooks/common"
import { FAILURE_REASON, QUIZ_STATUS } from "@/lib/constants"
import { queryKeys, quizQueryConfig } from "@/lib/queryConfig"

export const Route = createFileRoute("/_layout/quiz/$id/questions")({
  component: QuizQuestions,
})

function FailureReasonError({
  failureReason,
}: { failureReason: string | null | undefined }) {
  const { t } = useTranslation("quiz")

  if (!failureReason) {
    return null
  }

  // Get translated title and message based on failure reason
  const getErrorContent = () => {
    switch (failureReason) {
      case "canvas_export_error":
        return {
          title: t("failureMessages.canvas_export_error.title"),
          message: t("failureMessages.canvas_export_error.message"),
        }
      case "content_extraction_error":
        return {
          title: t("failureMessages.content_extraction_error.title"),
          message: t("failureMessages.content_extraction_error.message"),
        }
      case "no_content_found":
        return {
          title: t("failureMessages.no_content_found.title"),
          message: t("failureMessages.no_content_found.message"),
        }
      case "llm_generation_error":
        return {
          title: t("failureMessages.llm_generation_error.title"),
          message: t("failureMessages.llm_generation_error.message"),
        }
      case "no_questions_generated":
        return {
          title: t("failureMessages.no_questions_generated.title"),
          message: t("failureMessages.no_questions_generated.message"),
        }
      case "network_error":
        return {
          title: t("failureMessages.network_error.title"),
          message: t("failureMessages.network_error.message"),
        }
      case "validation_error":
        return {
          title: t("failureMessages.validation_error.title"),
          message: t("failureMessages.validation_error.message"),
        }
      default:
        return {
          title: t("failureMessages.generic.title"),
          message: t("failureMessages.generic.message"),
        }
    }
  }

  const { title, message } = getErrorContent()

  return (
    <Card.Root>
      <Card.Body>
        <ErrorState title={title} message={message} showRetry={false} />
      </Card.Body>
    </Card.Root>
  )
}

function QuizQuestions() {
  const { t } = useTranslation("quiz")
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Add dialog state management
  const [isManualQuestionDialogOpen, setIsManualQuestionDialogOpen] =
    useState(false)

  // Custom polling for questions route - stops polling during review state
  const questionsPolling = useConditionalPolling<Quiz>((data) => {
    if (!data?.status) return true // Poll if no status yet

    // Stop polling for stable states where user is actively working or quiz is complete
    const stableReviewStates = [
      QUIZ_STATUS.READY_FOR_REVIEW, // User is actively reviewing questions
      QUIZ_STATUS.READY_FOR_REVIEW_PARTIAL, // Partial review state
      QUIZ_STATUS.PUBLISHED, // Quiz completed and exported
      QUIZ_STATUS.FAILED, // Terminal error state
    ] as const

    return !stableReviewStates.includes(
      data.status as (typeof stableReviewStates)[number],
    )
  }, 10000) // Continue polling every 10 seconds for active processing states

  const { data: quiz, isLoading } = useQuery({
    queryKey: queryKeys.quiz(id),
    queryFn: async () => {
      const response = await QuizService.getQuiz({ quizId: id })
      return response
    },
    ...quizQueryConfig,
    refetchInterval: questionsPolling, // Use questions-specific polling logic
  })

  // Effect to invalidate questions cache when Canvas export failure is detected
  // This ensures the UI shows which questions were automatically unapproved
  useEffect(() => {
    if (
      quiz?.status === QUIZ_STATUS.FAILED &&
      quiz?.failure_reason === FAILURE_REASON.CANVAS_EXPORT_ERROR
    ) {
      // Invalidate questions cache to refresh and show unapproved questions
      queryClient.invalidateQueries({
        queryKey: queryKeys.quizQuestions(id),
      })
    }
  }, [quiz?.status, quiz?.failure_reason, id, queryClient])

  // Only show skeleton when loading and no cached data exists
  if (isLoading && !quiz) {
    return <QuizQuestionsSkeleton />
  }

  if (!quiz) {
    return <QuizQuestionsSkeleton />
  }

  return (
    <VStack gap={6} align="stretch">
      {/* Question Statistics */}
      {(quiz.status === QUIZ_STATUS.READY_FOR_REVIEW ||
        quiz.status === QUIZ_STATUS.READY_FOR_REVIEW_PARTIAL ||
        quiz.status === QUIZ_STATUS.EXPORTING_TO_CANVAS ||
        quiz.status === QUIZ_STATUS.PUBLISHED ||
        (quiz.status === QUIZ_STATUS.FAILED &&
          quiz.failure_reason === FAILURE_REASON.CANVAS_EXPORT_ERROR)) && (
        <QuestionStats quiz={quiz} isOwner={user?.id === quiz.owner_id} />
      )}

      {/* Canvas Export Error Banner */}
      {quiz.status === QUIZ_STATUS.FAILED &&
        quiz.failure_reason === FAILURE_REASON.CANVAS_EXPORT_ERROR && (
          <FailureReasonError failureReason={quiz.failure_reason} />
        )}

      {/* Review Questions Header with Add Question Button */}
      {(quiz.status === QUIZ_STATUS.READY_FOR_REVIEW ||
        quiz.status === QUIZ_STATUS.READY_FOR_REVIEW_PARTIAL ||
        quiz.status === QUIZ_STATUS.EXPORTING_TO_CANVAS ||
        quiz.status === QUIZ_STATUS.PUBLISHED ||
        (quiz.status === QUIZ_STATUS.FAILED &&
          quiz.failure_reason === FAILURE_REASON.CANVAS_EXPORT_ERROR)) && (
        <HStack justify="space-between" align="flex-start">
          <Box>
            <Text fontSize="2xl" fontWeight="bold" mb={2}>
              {t("questions.reviewTitle")}
            </Text>
            <Text color="gray.600">{t("questions.reviewDescription")}</Text>
          </Box>

          {/* Add Question Button - Only show in review states */}
          {(quiz.status === QUIZ_STATUS.READY_FOR_REVIEW ||
            quiz.status === QUIZ_STATUS.READY_FOR_REVIEW_PARTIAL) && (
            <Button
              variant="solid"
              colorPalette="green"
              size="sm"
              onClick={() => setIsManualQuestionDialogOpen(true)}
              flexShrink={0}
            >
              <LuPlus />
              {t("questions.addQuestion")}
            </Button>
          )}
        </HStack>
      )}

      {/* Question Review */}
      {(quiz.status === QUIZ_STATUS.READY_FOR_REVIEW ||
        quiz.status === QUIZ_STATUS.READY_FOR_REVIEW_PARTIAL ||
        quiz.status === QUIZ_STATUS.EXPORTING_TO_CANVAS ||
        quiz.status === QUIZ_STATUS.PUBLISHED ||
        (quiz.status === QUIZ_STATUS.FAILED &&
          quiz.failure_reason === FAILURE_REASON.CANVAS_EXPORT_ERROR)) && (
        <QuestionReview
          quizId={id}
          quizStatus={quiz.status}
          selectedModules={quiz.selected_modules}
        />
      )}

      {/* Error Display for Failed Status (except Canvas Export Error which is handled above) */}
      {quiz.status === QUIZ_STATUS.FAILED &&
        quiz.failure_reason !== FAILURE_REASON.CANVAS_EXPORT_ERROR && (
          <FailureReasonError failureReason={quiz.failure_reason} />
        )}

      {/* Message when questions aren't ready */}
      {quiz.status !== QUIZ_STATUS.READY_FOR_REVIEW &&
        quiz.status !== QUIZ_STATUS.READY_FOR_REVIEW_PARTIAL &&
        quiz.status !== QUIZ_STATUS.EXPORTING_TO_CANVAS &&
        quiz.status !== QUIZ_STATUS.PUBLISHED &&
        quiz.status !== QUIZ_STATUS.FAILED && (
          <Card.Root>
            <Card.Body>
              <EmptyState
                title={t("questions.notAvailable")}
                description={t("questions.notAvailableDescription")}
              />
            </Card.Body>
          </Card.Root>
        )}

      {/* Manual Question Dialog */}
      <ManualQuestionDialog
        quizId={id}
        quiz={{ status: quiz.status || "" }}
        isOpen={isManualQuestionDialogOpen}
        onOpenChange={setIsManualQuestionDialogOpen}
      />
    </VStack>
  )
}

function QuizQuestionsSkeleton() {
  return (
    <VStack gap={6} align="stretch">
      {/* Question Statistics Skeleton */}
      <Card.Root>
        <Card.Header>
          <LoadingSkeleton height="24px" width="200px" />
        </Card.Header>
        <Card.Body>
          <VStack gap={4} align="stretch">
            <LoadingSkeleton height="20px" width="100%" lines={2} />
            <LoadingSkeleton height="40px" width="150px" />
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Question Review Skeleton */}
      <Card.Root>
        <Card.Header>
          <LoadingSkeleton height="32px" width="180px" />
          <LoadingSkeleton height="16px" width="300px" />
        </Card.Header>
        <Card.Body>
          <VStack gap={4} align="stretch">
            {/* Filter buttons skeleton */}
            <LoadingSkeleton height="32px" width="200px" />

            {/* Questions list skeleton */}
            {[1, 2, 3].map((i) => (
              <Card.Root key={i}>
                <Card.Body>
                  <VStack gap={3} align="stretch">
                    <LoadingSkeleton height="20px" width="100%" lines={3} />
                    <LoadingSkeleton height="32px" width="120px" />
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  )
}
