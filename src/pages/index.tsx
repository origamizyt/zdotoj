import Difficulty from "../components/Difficulty";
import { Navbar } from "../components/Navbar";
import { Payload, Record$, Stat as ServerStat, UnitInfo, average, backend, readToken } from "../frontend/api"
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, IconButton, Card, CardBody, FormControl, FormLabel, Grid, GridItem, HStack, Input, Stack, Stat, StatGroup, StatLabel, StatNumber, Switch, Tag, Text, Wrap, Modal, useDisclosure, ModalOverlay, ModalBody, ModalContent, ModalHeader, ModalCloseButton, ModalFooter, Button, Table, Thead, Tr, Th, Tbody, Td, Tooltip } from "@chakra-ui/react";
import { IconBrandGatsby, IconBrandGithub, IconBrandGolang, IconBrandReact, IconBrandTabler, IconGitPullRequest, IconWifiOff } from "@tabler/icons-react";
import { HeadFC, PageProps } from "gatsby";
import { QRCodeCanvas } from "qrcode.react";
import AniLink from "gatsby-plugin-transition-link/AniLink";
import React from "react"

const Home: React.FC<PageProps> = () => {
  const [units, setUnits] = React.useState<UnitInfo[]>([]);
  const [filteredUnits, setFilteredUnits] = React.useState<UnitInfo[]>([]);
  const [filter, setFilter] = React.useState('');
  const [matchGroup, setMatchGroup] = React.useState(false);
  const [stat, setStat] = React.useState<ServerStat>();
  const [token, setToken] = React.useState<Payload>();
  const [viewingUnit, setViewingUnit] = React.useState<UnitInfo>();
  const [networkError, setNetworkError] = React.useState(false);
  const [records, setRecords] = React.useState<Record$[]>([]);
  const viewer = useDisclosure();

  const canEnter = viewingUnit && token && (!viewingUnit.groups || viewingUnit.groups.includes(token.subject.group));

  React.useEffect(() => {
    setToken(readToken());
    backend.fetchUnits().then(units => {
      setUnits(units);
      setFilteredUnits(units);
      if (token)
        backend.fetchRecentRecords(5).then(setRecords).catch(() => setNetworkError(true));
    }).catch(() => {
      setNetworkError(true);
    });
    backend.fetchStat().then(setStat).catch(() => setNetworkError(true));
  }, [])
  
  React.useEffect(() => {
    const tokens = filter.split(' ');
    let array = units.filter(unit => !token || !matchGroup || !unit.groups || unit.groups.includes(token!.subject.group));
    for (const token of tokens) {
      if (token.startsWith('@')) {
        const tag = token.slice(1);
        array = array.filter(unit => unit.tags.includes(tag));
      }
      else {
        array = array.filter(unit => unit.name.includes(token));
      }
    }
    setFilteredUnits(array);
  }, [filter, matchGroup]);

  function find(id: string) {
    return units.find(u => u.id === id);
  }

  return <>
    <Box h='100%'>
      <Navbar/>
      <Grid h='calc(100vh - 75px - .5rem)' templateColumns='repeat(4, 1fr)' gap={3}>
        <GridItem colSpan={1} pt={5} pl={3}>
          <Stack h='100%' borderColor='whiteAlpha.100' borderWidth={1} rounded={3} p={5}>
            <Text fontWeight={600} fontSize={25}>Statistics</Text>
            <StatGroup mt={3}>
              <Stat>
                <StatLabel>用户数量</StatLabel>
                <StatNumber>{ stat?.users }</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>单元数量</StatLabel>
                <StatNumber>{ stat?.units }</StatNumber>
              </Stat>
              <Stat>
                <StatLabel>记录数量</StatLabel>
                <StatNumber>{ stat?.records }</StatNumber>
              </Stat>
            </StatGroup>
            <Box flexGrow={1}/>
            <HStack justify='center'>
              <IconButton as='a' href='https://github.com/origamizyt/zdotoj' aria-label="Github" size='sm' variant='outline'>
                <IconBrandGithub size={18}/>
              </IconButton>
              <IconButton as='a' href='https://github.com/origamizyt/zdotoj/pulls' aria-label="Pull Request" size='sm' variant='outline'>
                <IconGitPullRequest size={18}/>
              </IconButton>
            </HStack>
            <Text fontSize={12} color='whiteAlpha.700' textAlign='center'>
              Copyleft 2024 Github/origamizyt.<br/>
              Z.OJ - Open source online judge application.
            </Text>
            <HStack justify='center'>
              <a href='https://go.dev' title='Golang' target='_blank'>
                <IconBrandGolang/>
              </a>
              <a href='https://react.dev' title='React' target='_blank'>
                <IconBrandReact/>
              </a>
              <a href='https://gatsbyjs.com' title='GatsbyJS' target='_blank'>
                <IconBrandGatsby/>
              </a>
              <a href='https://chakra-ui.com' title='Chakra UI' target='_blank'>
                <svg width="22" height="22" viewBox="0 0 582 582" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="582" height="582" rx="291" fill="#374152"/>
                  <path d="M157.521 303.421L355.881 106.426C359.587 102.746 365.55 107.225 363.049 111.809L289.22 247.123C287.573 250.141 289.758 253.821 293.196 253.821H420.782C424.892 253.821 426.877 258.857 423.872 261.661L200.293 470.326C196.284 474.067 190.317 468.796 193.536 464.356L299.373 318.351C301.543 315.357 299.404 311.164 295.706 311.164H160.713C156.67 311.164 154.653 306.27 157.521 303.421Z" fill="white"/>
                </svg>
              </a>
              <a href='https://tabler.io/icons' title='Tabler Icons' target='_blank'>
                <IconBrandTabler/>
              </a>
            </HStack>
          </Stack>
        </GridItem>
        <GridItem colSpan={2} pt={5} h='calc(100vh - 75px - .5rem)' display='flex' flexDirection='column'>
          {
            units.length ?
            <Card bg='whiteAlpha.50' cursor='pointer' onClick={() => {
              setViewingUnit(units[0]);
              viewer.onOpen();
            }}>
              <CardBody display='flex'>
                <Box textAlign='center' borderRightColor='whiteAlpha.100' borderRightWidth={1} pr={7} pl={2}>
                  <Text fontWeight={900} fontSize={35} lineHeight={10}>
                    {units[0].time.getDate()}
                  </Text>
                  <Text fontSize={14}>
                    {units[0].time.getFullYear()}/{units[0].time.getMonth()+1}
                  </Text>
                </Box>
                <Box pl={7} alignSelf='center'>
                  <Text fontSize={18} display='flex'>
                    {units[0].name}
                    <HStack gap={3} ml={2} as='span'>
                      {
                        units[0].tags.map(tag => <Tag key={tag} size='sm' variant='solid' colorScheme='green'>{tag}</Tag>)
                      }
                    </HStack>
                  </Text>
                  <Text fontSize={12} color='whiteAlpha.700'>
                    {units[0].time.toLocaleString()} ~ {units[0].deadline.toLocaleString()}
                  </Text>
                  <Text fontSize={12} color='whiteAlpha.700' display='flex' gap={2}>
                    难度: <Difficulty value={Math.round(units[0].difficulty)} postfix/>
                  </Text>
                </Box>
              </CardBody>
            </Card>
            : undefined
          }
          <Input placeholder='搜索' onChange={e => setFilter(e.target.value)} mt={2}/>
          <Text fontSize={12} color='whiteAlpha.600' mt={1}>格式: keyword1 keyword2 @tag1 @tag2...</Text>
          <FormControl display='flex' alignItems='center' mt={2} isDisabled={!token}>
            <FormLabel htmlFor='my-group-only' mb='0' fontSize={14} color='whiteAlpha.600'>
              只显示可做的单元
            </FormLabel>
            <Switch id='my-group-only' colorScheme='green' onChange={e => setMatchGroup(e.target.checked)}/>
          </FormControl>
          <Wrap justify='left' mt={2} overflowY='auto'>
            {
              filteredUnits.map(unit =>
                <Card bg='whiteAlpha.50' width='calc((100% - 0.5rem) / 2)' key={unit.id} cursor='pointer' onClick={() => {
                  setViewingUnit(unit);
                  viewer.onOpen();
                }}>
                  <CardBody>
                    <Box alignSelf='center'>
                      <Text fontSize={16} display='flex'>
                        {unit.name}
                        <HStack gap={3} ml={2} as='span'>
                          {
                            unit.tags.map(tag => <Tag key={tag} size='sm' variant='solid' colorScheme='green'>{tag}</Tag>)
                          }
                        </HStack>
                      </Text>
                      <Text fontSize={12} color='whiteAlpha.700' display='flex' gap={2}>
                        Deadline {units[0].deadline.toLocaleString()},
                        <Difficulty value={Math.round(unit.difficulty)}/>
                      </Text>
                    </Box>
                  </CardBody>
                </Card>
              )
            }
            { filteredUnits.length ? undefined : <Alert status='info' variant='left-accent' rounded={3}>
                <AlertIcon/>
                <AlertTitle>没有符合条件的单元。</AlertTitle>
                <AlertDescription>请更换筛选条件。</AlertDescription>
              </Alert>
            }
          </Wrap>
        </GridItem>
        <GridItem colSpan={1} pt={5} pr={3}>
          <Stack h='100%' borderColor='whiteAlpha.100' borderWidth={1} rounded={3} p={5}>
            <Text fontWeight={600} fontSize={25}>Recently</Text>
            <Stack gap={1}>
              {
                token && records.length ? undefined:
                <Alert status='info' variant='left-accent' rounded={3}>
                  <AlertIcon/>
                  <AlertTitle>无记录</AlertTitle>
                  <AlertDescription>完成题目以添加记录。</AlertDescription>
                </Alert>
              }
              { records.map(record => 
                <Card key={record.id} cursor='pointer' onClick={() => {
                  setViewingUnit(find(record.unit)!);
                  viewer.onOpen();
                }} bg='whiteAlpha.50'>
                  <CardBody py={3} px={5}>
                    <HStack justify='space-between'>
                      <Text fontWeight={600}>
                        {find(record.unit)?.name}
                      </Text>
                      <Text as='span' fontSize={12} fontFamily='var(--mono-font)' color='whiteAlpha.600'>
                        {find(record.unit)?.id}
                      </Text>
                    </HStack>
                    <StatGroup mt={2}>
                      <Stat>
                        <StatLabel>AC 题目数</StatLabel>
                        <StatNumber>
                          { record.entries.filter(e => e.total > 0 && e.passed === e.total).length }
                        </StatNumber>
                      </Stat>
                      <Stat>
                        <StatLabel>平均正确率</StatLabel>
                        <StatNumber>
                          { Math.round(average(record) * 100) }% 
                        </StatNumber>
                      </Stat>
                    </StatGroup>
                  </CardBody>
                </Card>
              )}
            </Stack>
          </Stack>
        </GridItem>
      </Grid>
    </Box>
    <Modal isOpen={networkError} onClose={() => {}} isCentered closeOnEsc={false} closeOnOverlayClick={false}>
      <ModalOverlay backdropFilter='blur(5px)'/>
      <ModalContent bg='transparent' boxShadow='none'>
        <ModalBody textAlign='center'>
          <IconWifiOff style={{ display: 'inline-block' }} size={60} color='var(--chakra-colors-red-400)'/>
          <Text fontSize={25} fontWeight={600}>
            网络出现问题。
          </Text>
        </ModalBody>
      </ModalContent>
    </Modal>
    <Modal isOpen={viewer.isOpen} onClose={viewer.onClose} isCentered size='xl'>
      <ModalOverlay backdropFilter='blur(5px)'/>
      <ModalContent>
        <ModalHeader>单元信息：{viewingUnit?.name}</ModalHeader>
        <ModalCloseButton/>
        <ModalBody display='flex' pr={10}>
          <Table variant='striped'>
            <Thead>
              <Tr>
                <Th>项目</Th>
                <Th>值</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td fontWeight={600}>ID</Td>
                <Td fontFamily='var(--mono-font)' fontSize={13}>{viewingUnit?.id}</Td>
              </Tr>
              <Tr>
                <Td fontWeight={600}>发布时间</Td>
                <Td>{viewingUnit?.time.toLocaleString()}</Td>
              </Tr>
              <Tr>
                <Td fontWeight={600}>截止时间</Td>
                <Td>{viewingUnit?.deadline.toLocaleString()}</Td>
              </Tr>
              <Tr>
                <Td fontWeight={600}>题目数量</Td>
                <Td>{viewingUnit?.objectiveCount}</Td>
              </Tr>
              <Tr>
                <Td fontWeight={600}>难度</Td>
                <Td>{viewingUnit?.difficulty.toFixed(1)}</Td>
              </Tr>
              <Tr>
                <Td fontWeight={600}>Tags</Td>
                <Td>
                  <HStack gap={3} as='span'>
                    {
                      viewingUnit?.tags.map(tag => <Tag key={tag} size='sm' variant='solid' colorScheme='green'>{tag}</Tag>)
                    }
                  </HStack>
                </Td>
              </Tr>
            </Tbody>
          </Table>
          <Box>
            {
              globalThis.location ?
              <QRCodeCanvas value={`${location.origin}/unit?id=${viewingUnit?.id}`} bgColor='transparent' fgColor='white'/>
              : undefined
            }
            <Text textAlign='center' color='whiteAlpha.600' fontSize={14} mt={2}>
              单元QR
            </Text>
          </Box>
        </ModalBody>
        <ModalFooter as={Stack}>
          { canEnter ?
          <AniLink to={`/unit?id=${viewingUnit?.id}`} paintDrip hex='#222230' style={{ flexGrow: 1, width: '100%' }}>
            <Button colorScheme='green' w='100%'>前往</Button>
          </AniLink>
          :
          <Tooltip label='你未登录或不在指定的组中。' placement='top'>
            <Button colorScheme='green' w='100%' isDisabled>前往</Button>
          </Tooltip>
          }
          {
            token && token.subject.admin ?
            <AniLink to={`/design?id=${viewingUnit?.id}`} paintDrip hex='#222230' style={{ flexGrow: 1, width: '100%' }}>
              <Button colorScheme='blue' w='100%'>编辑</Button>
            </AniLink>
            : undefined
          }
        </ModalFooter>
      </ModalContent>
    </Modal>
  </>
}

export default Home;

export const Head: HeadFC = () => <title>主页 | Z.OJ</title>;