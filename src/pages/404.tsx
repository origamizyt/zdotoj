import * as React from "react"
import { HeadFC, PageProps } from "gatsby"
import { Box, Button, HStack, Stack } from "@chakra-ui/react"
import { IconError404 } from "@tabler/icons-react"
import AniLink from "gatsby-plugin-transition-link/AniLink"

const NotFoundPage: React.FC<PageProps> = () => {
  return <>
    <Stack h='100vh' justify='center'>
      <HStack justify='center'>
        <Box textAlign='center'>
          <IconError404 size={75} style={{ display: 'inline-block' }}/>
          <AniLink to='/' paintDrip hex='#222230'>
            <Button variant='ghost' w='100%' size='sm'>Go Home</Button>
          </AniLink>
        </Box>
      </HStack>
    </Stack>
  </>
}

export default NotFoundPage

export const Head: HeadFC = () => <title>404 | Z.OJ</title>
