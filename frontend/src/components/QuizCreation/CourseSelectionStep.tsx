import {
  Alert,
  Box,
  Button,
  Card,
  HStack,
  Input,
  RadioGroup,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { CanvasService } from "@/client"
import { LoadingSkeleton } from "@/components/Common"
import { Field } from "@/components/ui/field"
import { analyzeCanvasError } from "@/lib/utils"

interface Course {
  id: number
  name: string
}

interface CourseSelectionStepProps {
  selectedCourse?: Course
  onCourseSelect: (course: Course) => void
  title?: string
  onTitleChange: (title: string) => void
}

export function CourseSelectionStep({
  selectedCourse,
  onCourseSelect,
  title,
  onTitleChange,
}: CourseSelectionStepProps) {
  const { t } = useTranslation("creation")
  const {
    data: courses,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["canvas-courses"],
    queryFn: CanvasService.getCourses,
    retry: 1, // Only retry once instead of default 3 times
    retryDelay: 1000, // Wait 1 second between retries
    staleTime: 30000, // Consider data stale after 30 seconds
  })

  if (isLoading || isFetching) {
    return (
      <VStack gap={4} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">
          {isLoading
            ? t("courseSelection.loadingCourses")
            : t("common.retrying")}
        </Text>
        <LoadingSkeleton height="60px" lines={3} />
      </VStack>
    )
  }

  if (error) {
    const errorInfo = analyzeCanvasError(error)

    return (
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Title>{t("courseSelection.failedToLoad")}</Alert.Title>
        <Alert.Description>
          <VStack gap={3} align="stretch">
            <Text>{errorInfo.userFriendlyMessage}</Text>
            <Text fontSize="sm" color="gray.600">
              {errorInfo.actionableGuidance}
            </Text>
            <Button
              variant="solid"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              loading={isFetching}
            >
              {t("common.tryAgain")}
            </Button>
          </VStack>
        </Alert.Description>
      </Alert.Root>
    )
  }

  if (!courses || courses.length === 0) {
    return (
      <Alert.Root status="info">
        <Alert.Indicator />
        <Alert.Title>{t("courseSelection.noCourses")}</Alert.Title>
        <Alert.Description>
          {t("courseSelection.noCoursesDescription")}
        </Alert.Description>
      </Alert.Root>
    )
  }

  return (
    <VStack gap={4} align="stretch">
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={2}>
          {t("courseSelection.title")}
        </Text>
        <Text color="gray.600" fontSize="sm">
          {t("courseSelection.description")}
        </Text>
        <Text color="gray.600" fontSize="sm">
          {t("courseSelection.chooseDescription")}
        </Text>
      </Box>

      <RadioGroup.Root value={selectedCourse?.id?.toString() || ""}>
        <VStack gap={3} align="stretch">
          {courses.map((course) => (
            <Card.Root
              key={course.id}
              variant="outline"
              cursor="pointer"
              _hover={{ borderColor: "blue.300" }}
              borderColor={
                selectedCourse?.id === course.id ? "blue.500" : "gray.200"
              }
              bg={selectedCourse?.id === course.id ? "blue.50" : "white"}
              onClick={() => {
                onCourseSelect(course)
              }}
              data-testid={`course-card-${course.id}`}
            >
              <Card.Body p={4}>
                <HStack gap={3}>
                  <RadioGroup.Item value={course.id.toString()}>
                    <RadioGroup.ItemControl />
                  </RadioGroup.Item>
                  <Box flex={1}>
                    <Text fontWeight="medium" fontSize="md" lineClamp={2}>
                      {course.name || t("courseSelection.unnamedCourse")}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {t("courseSelection.courseId", { id: course.id || "?" })}
                    </Text>
                  </Box>
                </HStack>
              </Card.Body>
            </Card.Root>
          ))}
        </VStack>
      </RadioGroup.Root>

      {selectedCourse && (
        <VStack gap={4} align="stretch">
          <Alert.Root status="success">
            <Alert.Indicator />
            <Alert.Description>
              {t("courseSelection.selected", {
                courseName: selectedCourse.name,
              })}
            </Alert.Description>
          </Alert.Root>

          <Box>
            <Field label={t("quizTitle.label")} required>
              <Input
                value={title || ""}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={t("quizTitle.placeholder")}
                data-testid="quiz-title-input"
              />
            </Field>
            <Text fontSize="sm" color="gray.600" mt={1}>
              {t("quizTitle.description")}
            </Text>
          </Box>
        </VStack>
      )}
    </VStack>
  )
}
