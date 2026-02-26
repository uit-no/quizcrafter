import { Box, Stack, Text } from "@chakra-ui/react"
import { useTranslation } from "react-i18next"

export const SetupStep = () => {
  const { t } = useTranslation("common")

  return (
    <Stack align="center" minH="300px" justify="center">
      <Box textAlign="left">
        <Text
          fontSize="2xl"
          fontWeight="bold"
          color="ui.main"
          mb={4}
          textAlign="center"
        >
          {t("onboarding.setup.title")}
        </Text>
        <Text fontSize="lg" color="gray.600" lineHeight="tall">
          - {t("onboarding.setup.tip1")}
        </Text>
        <Text fontSize="lg" color="gray.600" lineHeight="tall">
          - {t("onboarding.setup.tip2")}
        </Text>
        <Text fontSize="lg" color="gray.600" lineHeight="tall">
          - {t("onboarding.setup.tip3")}
        </Text>
      </Box>
    </Stack>
  )
}
