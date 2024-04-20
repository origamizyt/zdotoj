import { Box, Text } from "@chakra-ui/react"
import { IconCoffee } from "@tabler/icons-react"
import React from 'react';

export interface DifficultyProps {
  value: number
  postfix?: boolean
}

export default function Difficulty(props: DifficultyProps) {
  return <Box display='inline-flex' as='span'>
    {
      new Array(props.value).fill(0).map((_, index) => <IconCoffee size={12} stroke={1} style={{ alignSelf: 'center' }} key={index}/>)
    }

    {
      props.postfix ? <Text fontSize={12} ml={2} as='span'>({props.value.toFixed(1)})</Text> : undefined
    }
  </Box>
}