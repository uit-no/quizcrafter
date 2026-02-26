import { AspectRatio, Box, Stack, Text } from "@chakra-ui/react"
import { useTranslation } from "react-i18next"

export const SetupStep = () => {
  const { t } = useTranslation("common")

  return (
    <Stack gap={6} align="center" minH="300px" justify="center">
      <Box textAlign="center">
        <Text fontSize="2xl" fontWeight="bold" color="ui.main" mb={4}>
          {t("onboarding.setup.title")}
        </Text>
        <AspectRatio ratio={16 / 9}>
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/E397yownTgs?si=4La3psPHqKLs_ab7"
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            style={{
              borderRadius: "8px",
              border: "none",
            }}
          />
        </AspectRatio>
      </Box>
    </Stack>
  )
}
