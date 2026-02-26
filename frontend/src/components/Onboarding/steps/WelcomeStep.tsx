import { Box, Stack, Text } from "@chakra-ui/react"
import { useTranslation } from "react-i18next"

export const WelcomeStep = () => {
  const { t } = useTranslation("common")

  return (
    <Stack gap={6} align="center" py={8} minH="300px" justify="center">
      <Box textAlign="center">
        <Text fontSize="2xl" fontWeight="bold" color="ui.main" mb={4}>
          {t("onboarding.welcome.title")}
        </Text>
        <Text fontSize="lg" color="gray.600" lineHeight="tall">
          {t("onboarding.welcome.description")}
        </Text>
      </Box>
    </Stack>
  )
}
