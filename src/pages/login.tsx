import { Reason, backend, formatReason } from "../frontend/api";
import { Box, Button, FormControl, FormLabel, Grid, GridItem, HStack, Input, Text, useToast } from "@chakra-ui/react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { HeadFC, navigate } from "gatsby";
import React from "react";
import useCaptcha from "../hooks/useCaptcha";

export default function Login() {
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const captcha = useCaptcha();
  const [captchaValue, setCaptchaValue] = React.useState('');
  const toast = useToast({
    position: 'top',
    duration: 4000,
  });

  return <>
    <Grid templateColumns='repeat(3, 1fr)' h='100vh'>
      <GridItem colSpan={2} h='100%' bg='whiteAlpha.50' display='flex' flexDirection='column' justifyContent='center'>
        <HStack justify='center'>
          <img src='/ZOJ_Logo_v1.png' alt='Logo' width='400'/>
        </HStack>
      </GridItem>
      <GridItem colSpan={1} h='100%' display='flex' flexDirection='column' justifyContent='center'>
        <Box textAlign='center' px={10} as='form' onSubmit={e => {
          e.preventDefault();
          backend.login({ name, password }, { captcha: captchaValue, captchaId: captcha.id })
          .then(() => {
            navigate('/');
          })
          .catch((reason: Reason) => {
            switch (`${reason.category}.${reason.id}`) {
              case 'account.wrongLogin': {
                toast({
                  title: '登入失败',
                  description: '用户名或密码错误。',
                  status: 'error',
                });
                break;
              }
              case 'account.wrongCaptcha': {
                toast({
                  title: '登入失败',
                  description: '验证码错误。',
                  status: 'error',
                });
                break;
              }
              default: {
                toast({
                  title: '登入失败',
                  description: `请求错误：${formatReason(reason)}`,
                  status: 'error',
                });
                break;
              }
            }
            captcha.update();
          })
        }}>
          <Text fontWeight={600} fontSize={30}>登入</Text>
          <FormControl mt={3}>
            <FormLabel>用户 ID</FormLabel>
            <Input placeholder='cin &gt;&gt; username;' _placeholder={{ fontFamily: 'var(--mono-font)' }}
              onChange={e => setName(e.target.value)} isRequired value={name}/>
          </FormControl>
          <FormControl mt={3}>
            <FormLabel>密码</FormLabel>
            <Input placeholder='cin &gt;&gt; password;' type='password' _placeholder={{ fontFamily: 'var(--mono-font)' }}
              onChange={e => setPassword(e.target.value)} isRequired value={password}/>
          </FormControl>
          <FormControl mt={3}>
            <FormLabel>验证码</FormLabel>
            <HStack>
              <Input onChange={e => setCaptchaValue(e.target.value)} isRequired value={captchaValue}/>
              { captcha.ready ? <img src={captcha.imageURL} alt="Captcha Image" width='150' className='captcha' onClick={captcha.update}/> : undefined}
            </HStack>
          </FormControl>
          <HStack mt={6} justify='space-evenly'>
            <Button leftIcon={<IconCheck/>} colorScheme='green' type='submit'>
              确认
            </Button>
            <Button leftIcon={<IconX/>} colorScheme='red' onClick={() => {
              setName('');
              setPassword('');
            }}>
              清空
            </Button>
          </HStack>
        </Box>
      </GridItem>
    </Grid>
  </>
}

export const Head: HeadFC = () => <title>登入 | Z.OJ</title>;