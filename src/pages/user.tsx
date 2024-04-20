import React from "react";
import { Navbar } from "../components/Navbar";
import { HeadFC } from "gatsby";
import { Payload, Reason, backend, formatReason, readToken } from "../frontend/api";
import { Box, Button, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerFooter, DrawerHeader, DrawerOverlay, FormControl, FormHelperText, FormLabel, HStack, Input, Stack, Table, Tbody, Td, Text, Th, Thead, Tr, useDisclosure, useToast } from "@chakra-ui/react";
import { IconUserSquareRounded } from "@tabler/icons-react";
import AniLink from "gatsby-plugin-transition-link/AniLink";
import useCaptcha from "../hooks/useCaptcha";

export default function User() {
  const [token, setToken] = React.useState<Payload>();
  const [captchaValue, setCaptchaValue] = React.useState('');
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const captcha = useCaptcha({ initialUpdate: false });
  const toast = useToast({
    position: 'top',
    duration: 4000,
  });
  const passwordChanger = useDisclosure({
    onOpen() {
      captcha.update();
    },
    onClose() {
      setCaptchaValue('');
      setOldPassword('');
      setNewPassword('');
    }
  });
  React.useEffect(() => {
    setToken(readToken());
  }, []);
  return <>
    <Navbar/>
    <Stack h='calc(100vh - 75px)' justify='center'>
      <HStack justify='center'>
        <Box textAlign='center'>
          <IconUserSquareRounded size={100} style={{ display: 'inline-block' }}/>
          <Text fontWeight={600} fontSize={30}>{token?.subject.name}</Text>
          <Text fontFamily='var(--mono-font)' fontSize={13}>ID: {token?.subject.id}</Text>
          <Table size='sm' mt={3}>
            <Thead>
              <Tr>
                <Th>Properties</Th>
                <Th>Values</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>用户组</Td>
                <Td>{token?.subject.group}</Td>
              </Tr>
              <Tr>
                <Td>客户端 IP</Td>
                <Td>{token?.address}</Td>
              </Tr>
              <Tr>
                <Td>会话过期时间</Td>
                <Td>{token?.expires.toLocaleString()}</Td>
              </Tr>
              <Tr>
                <Td>管理员</Td>
                <Td>{token?.subject.admin ? 'Yes' : 'No'}</Td>
              </Tr>
            </Tbody>
          </Table>
          <HStack mt={3} justify='center'>
            <Button onClick={passwordChanger.onOpen}>修改密码</Button>
            <AniLink to='/' cover direction='down' bg='#222230'>
              <Button colorScheme='red' onClick={() => {
                document.cookie = 'zdotoj-token=; max-age=0';
                
              }}>登出</Button>
            </AniLink>
          </HStack>
        </Box>
      </HStack>
    </Stack>
    <Drawer isOpen={passwordChanger.isOpen} onClose={passwordChanger.onClose} placement="right" size='md'>
      <DrawerOverlay backdropFilter='blur(5px)'/>
      <DrawerContent>
        <DrawerCloseButton/>
        <DrawerHeader>更改密码</DrawerHeader>
        <DrawerBody>
          <Stack as='form' onSubmit={e => {
            e.preventDefault();
            backend.password({ oldPassword, newPassword }, { captcha: captchaValue, captchaId: captcha.id })
            .then(() => {
              toast({
                title: '操作成功',
                description: '成功更换密码。',
                status: 'success',
              });
              passwordChanger.onClose();
            })
            .catch((reason: Reason) => {
              switch (`${reason.category}.${reason.id}`) {
                case 'account.wrongPassword': {
                  toast({
                    title: '操作失败',
                    description: '密码错误。',
                    status: 'error',
                  });
                  break;
                }
                case 'account.wrongCaptcha': {
                  toast({
                    title: '操作失败',
                    description: '验证码错误。',
                    status: 'error',
                  });
                  break;
                }
                default: {
                  toast({
                    title: '操作失败',
                    description: `请求错误：${formatReason(reason)}`,
                    status: 'error',
                  });
                  break;
                }
              }
              captcha.update();
            })
          }} ref={formRef}>
            <FormControl>
              <FormLabel>旧密码</FormLabel>
              <Input placeholder="cin &gt;&gt; oldpass;" _placeholder={{ fontFamily: 'var(--mono-font)' }} type='password' onChange={e => {
                setOldPassword(e.target.value);
              }} value={oldPassword} isRequired/>
            </FormControl>
            <FormControl>
              <FormLabel>新密码</FormLabel>
              <Input placeholder="cin &gt;&gt; newpass;" _placeholder={{ fontFamily: 'var(--mono-font)' }} type='password' onChange={e => {
                setNewPassword(e.target.value);
              }} value={newPassword} isRequired/>
              <FormHelperText>
                密码使用 Argon2id 哈希算法存储。
              </FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>验证码</FormLabel>
              <HStack>
                <Input onChange={e => setCaptchaValue(e.target.value)} isRequired value={captchaValue}/>
                { captcha.ready ? <img src={captcha.imageURL} alt="Captcha Image" width='150' className='captcha' onClick={captcha.update}/> : undefined}
              </HStack>
            </FormControl>
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Button colorScheme="green" type='submit' onClick={() => {
            formRef.current!.requestSubmit();
          }}>确认</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </>
}

export const Head: HeadFC = () => <title>用户 | Z.OJ</title>;