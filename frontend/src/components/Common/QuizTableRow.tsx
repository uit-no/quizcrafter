import { Badge, HStack, Table, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "@tanstack/react-router"
import { memo } from "react"
import { useTranslation } from "react-i18next"

import type { Quiz } from "@/client/types.gen"
import { Button } from "@/components/ui/button"
import { StatusLight } from "@/components/ui/status-light"
import { useFormattedDate } from "@/hooks"
import { getQuizStatusKey, getSelectedModulesCount } from "@/lib/utils"

interface QuizTableRowProps {
  quiz: Quiz
}

export const QuizTableRow = memo(function QuizTableRow({
  quiz,
}: QuizTableRowProps) {
  const { t } = useTranslation(["quiz", "common"])
  const moduleCount = getSelectedModulesCount(quiz)
  const formattedCreatedAt = useFormattedDate(quiz.created_at, "short")

  return (
    <Table.Row key={quiz.id}>
      <Table.Cell>
        <RouterLink to="/quiz/$id" params={{ id: quiz.id! }}>
          <Text fontWeight="medium" _hover={{ textDecoration: "underline" }}>
            {quiz.title}
          </Text>
        </RouterLink>
      </Table.Cell>
      <Table.Cell>
        <VStack align="start" gap={1}>
          <Text>{quiz.canvas_course_name}</Text>
          <Text fontSize="sm" color="gray.500">
            {t("quiz:table.modulesSelected", { count: moduleCount })}
          </Text>
        </VStack>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="solid" colorScheme="blue">
          {quiz.question_count}
        </Badge>
      </Table.Cell>
      <Table.Cell>
        <HStack gap={2} align="center">
          <StatusLight status={quiz.status || "created"} />
          <Text fontSize="sm" color="gray.600">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(t as any)(`quiz:status.${getQuizStatusKey(quiz)}`)}
          </Text>
        </HStack>
      </Table.Cell>
      <Table.Cell>
        <Text fontSize="sm">
          {formattedCreatedAt || t("common:status.unknown")}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <HStack gap={2}>
          <Button size="sm" variant="outline" asChild>
            <RouterLink to="/quiz/$id" params={{ id: quiz.id! }}>
              {t("common:actions.view")}
            </RouterLink>
          </Button>
        </HStack>
      </Table.Cell>
    </Table.Row>
  )
})
