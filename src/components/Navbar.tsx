import { Payload, readToken } from '../frontend/api';
import { Box, Link, HStack } from '@chakra-ui/react'
import AniLink from 'gatsby-plugin-transition-link/AniLink';
import React from 'react';

export function Navbar() {
  const [token, setToken] = React.useState<Payload>();
  React.useEffect(() => {
    setToken(readToken());
  }, []);
  return (
    <HStack borderBottomWidth={1} borderColor='whiteAlpha.200' h='75px' px={10} py={5} gap='40px'>
      <AniLink to='/' cover direction='down' bg='#222230'>
        <img src='/ZOJ_Logo_v1.png' alt='brand' width='70' style={{ alignSelf: 'center' }}/>
      </AniLink>
      <Box flexGrow={1}/>
      { token && token.subject.admin ?
        <Link to='/design' alignSelf='center' as={AniLink} cover direction='right' bg='#222230' backgroundColor='transparent'>
          + 创建单元
        </Link>
      : undefined}
      { token ? 
        <Link to='/user' alignSelf='center' as={AniLink} cover direction='right' bg='#222230' backgroundColor='transparent'>欢迎, {token.subject.name}</Link>
        :
        <Link to='/login' alignSelf='center' as={AniLink} cover direction='right' bg='#222230' backgroundColor='transparent'>登入</Link>
      }
    </HStack>
  )
}